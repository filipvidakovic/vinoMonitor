use chrono::Utc;
use futures::TryStreamExt;
use mongodb::{
    bson::{doc, Bson, Document},
    error::{ErrorKind, WriteFailure},
    options::{FindOneAndUpdateOptions, FindOptions, IndexOptions, ReturnDocument},
    Client, Collection, IndexModel,
};

use crate::{
    error::AppError,
    models::{
        Bottle, BottleStatus, BottleSummary, Bottling, BottlesPage, BottlesQuery, InventoryStats,
        StatusCounts, BOTTLE_VOLUME_LITERS,
    },
};

#[derive(Clone)]
pub struct InventoryRepository {
    bottlings: Collection<Bottling>,
    bottles: Collection<Bottle>,
}

impl InventoryRepository {
    pub async fn connect(uri: &str, db_name: &str) -> anyhow::Result<Self> {
        let client = Client::with_uri_str(uri).await?;
        let db = client.database(db_name);
        db.run_command(doc! { "ping": 1 }, None).await?;

        let repo = Self {
            bottlings: db.collection("bottlings"),
            bottles: db.collection("bottles"),
        };
        repo.ensure_indexes().await?;
        Ok(repo)
    }

    async fn ensure_indexes(&self) -> anyhow::Result<()> {
        let unique = |keys: Document| {
            IndexModel::builder()
                .keys(keys)
                .options(IndexOptions::builder().unique(true).build())
                .build()
        };

        // Jedan batch se flašira jednom
        self.bottlings
            .create_indexes([unique(doc! { "batch_id": 1 }), unique(doc! { "lot_code": 1 })], None)
            .await?;
        self.bottles
            .create_indexes(
                [
                    unique(doc! { "serial": 1 }),
                    IndexModel::builder().keys(doc! { "bottling_id": 1, "number": 1 }).build(),
                    IndexModel::builder().keys(doc! { "status": 1 }).build(),
                ],
                None,
            )
            .await?;
        Ok(())
    }

    // ============== Bottlings ==============

    /// Upisuje lot i sve njegove flaše. MongoDB bez replica set-a nema transakcije,
    /// pa se lot briše ako upis flaša ne uspe.
    pub async fn create_bottling(&self, bottling: &Bottling, bottles: &[Bottle]) -> Result<(), AppError> {
        self.bottlings.insert_one(bottling, None).await.map_err(|e| {
            if is_duplicate_key(&e) {
                AppError::Conflict("This batch has already been bottled".to_string())
            } else {
                AppError::DatabaseError(e)
            }
        })?;

        if let Err(e) = self.bottles.insert_many(bottles, None).await {
            let _ = self.bottles.delete_many(doc! { "bottling_id": &bottling.id }, None).await;
            let _ = self.bottlings.delete_one(doc! { "_id": &bottling.id }, None).await;
            return Err(AppError::DatabaseError(e));
        }

        Ok(())
    }

    pub async fn find_bottling(&self, id: &str) -> Result<Bottling, AppError> {
        self.bottlings
            .find_one(doc! { "_id": id }, None)
            .await?
            .ok_or_else(|| AppError::NotFound("Bottling not found".to_string()))
    }

    pub async fn list_bottlings(&self, batch_id: Option<&str>) -> Result<Vec<Bottling>, AppError> {
        let filter = match batch_id {
            Some(b) => doc! { "batch_id": b },
            None => doc! {},
        };
        let options = FindOptions::builder().sort(doc! { "bottled_at": -1 }).build();
        let bottlings = self.bottlings.find(filter, options).await?.try_collect().await?;
        Ok(bottlings)
    }

    /// Broj flaša po statusu - za jedan lot ili ceo inventar
    pub async fn status_counts(&self, bottling_id: Option<&str>) -> Result<StatusCounts, AppError> {
        let mut pipeline = Vec::new();
        if let Some(id) = bottling_id {
            pipeline.push(doc! { "$match": { "bottling_id": id } });
        }
        pipeline.push(doc! { "$group": { "_id": "$status", "n": { "$sum": 1 } } });

        let mut counts = StatusCounts::default();
        let mut cursor = self.bottles.aggregate(pipeline, None).await?;
        while let Some(row) = cursor.try_next().await? {
            let n = match row.get("n") {
                Some(Bson::Int32(v)) => *v as i64,
                Some(Bson::Int64(v)) => *v,
                _ => 0,
            };
            match row.get_str("_id").unwrap_or_default() {
                "in_stock" => counts.in_stock = n,
                "sold" => counts.sold = n,
                "damaged" => counts.damaged = n,
                _ => {}
            }
        }
        Ok(counts)
    }

    // ============== Bottles ==============

    pub async fn list_bottles(&self, q: &BottlesQuery) -> Result<BottlesPage, AppError> {
        let mut filter = doc! {};
        if let Some(id) = &q.bottling_id {
            filter.insert("bottling_id", id);
        }
        if let Some(status) = q.status {
            filter.insert("status", status.as_str());
        }
        if let Some(search) = q.search.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            filter.insert("serial", doc! { "$regex": escape_regex(search), "$options": "i" });
        }

        let limit = q.limit.unwrap_or(50).clamp(1, 500);
        let total = self.bottles.count_documents(filter.clone(), None).await?;

        let options = FindOptions::builder()
            .projection(doc! { "provenance": 0 })
            .sort(doc! { "bottling_id": 1, "number": 1 })
            .skip(q.offset.unwrap_or(0))
            .limit(limit)
            .build();

        let items = self
            .bottles
            .clone_with_type::<BottleSummary>()
            .find(filter, options)
            .await?
            .try_collect()
            .await?;

        Ok(BottlesPage { items, total })
    }

    /// Flaša po serijskom broju (ili internom ID-u) - sa kompletnim poreklom
    pub async fn find_bottle(&self, serial_or_id: &str) -> Result<Bottle, AppError> {
        self.bottles
            .find_one(doc! { "$or": [ { "serial": serial_or_id }, { "_id": serial_or_id } ] }, None)
            .await?
            .ok_or_else(|| AppError::NotFound("Bottle not found".to_string()))
    }

    pub async fn update_bottle_status(&self, serial: &str, status: BottleStatus) -> Result<Bottle, AppError> {
        let options = FindOneAndUpdateOptions::builder()
            .return_document(ReturnDocument::After)
            .build();

        self.bottles
            .find_one_and_update(
                doc! { "serial": serial },
                doc! { "$set": {
                    "status": status.as_str(),
                    "status_changed_at": Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Micros, true),
                } },
                options,
            )
            .await?
            .ok_or_else(|| AppError::NotFound("Bottle not found".to_string()))
    }

    pub async fn stats(&self) -> Result<InventoryStats, AppError> {
        let lots = self.bottlings.count_documents(doc! {}, None).await?;
        let counts = self.status_counts(None).await?;
        let liters_in_stock = round2(counts.in_stock as f64 * BOTTLE_VOLUME_LITERS);
        Ok(InventoryStats { lots, counts, liters_in_stock })
    }
}

fn is_duplicate_key(e: &mongodb::error::Error) -> bool {
    matches!(
        e.kind.as_ref(),
        ErrorKind::Write(WriteFailure::WriteError(we)) if we.code == 11000
    )
}

fn escape_regex(s: &str) -> String {
    s.chars()
        .flat_map(|c| {
            let special = "\\^$.|?*+()[]{}".contains(c);
            special.then_some('\\').into_iter().chain(std::iter::once(c))
        })
        .collect()
}

pub fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::escape_regex;

    #[test]
    fn escapes_regex_metacharacters() {
        assert_eq!(escape_regex("L26-ABC"), "L26-ABC");
        assert_eq!(escape_regex("a.b*(c)"), "a\\.b\\*\\(c\\)");
    }
}

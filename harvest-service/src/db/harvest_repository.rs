use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    AddQualityMeasurementRequest, CreateHarvestRequest, Harvest, HarvestQuality,
    HarvestStatus, UpdateHarvestRequest,
};

#[derive(Clone)]
pub struct HarvestRepository {
    pool: PgPool,
}

impl HarvestRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============== Harvest CRUD ==============

    pub async fn create_harvest(
        &self,
        created_by: Uuid,
        req: CreateHarvestRequest,
    ) -> Result<Harvest, AppError> {
        let harvest = sqlx::query_as::<_, Harvest>(
            r#"
            INSERT INTO harvests (
                parcel_id, vineyard_id, harvest_date,
                total_weight_kg, yield_per_hectare,
                weather_condition, temperature_celsius, humidity_percent,
                notes, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
            "#,
        )
            .bind(req.parcel_id)
            .bind(req.vineyard_id)
            .bind(req.harvest_date)
            .bind(req.total_weight_kg)
            .bind(req.yield_per_hectare)
            .bind(req.weather_condition)
            .bind(req.temperature_celsius)
            .bind(req.humidity_percent)
            .bind(req.notes)
            .bind(created_by)
            .fetch_one(&self.pool)
            .await?;

        Ok(harvest)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Harvest, AppError> {
        sqlx::query_as::<_, Harvest>("SELECT * FROM harvests WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Harvest not found".to_string()),
                _ => AppError::DatabaseError(e),
            })
    }

    pub async fn list_by_vineyard(&self, vineyard_id: Uuid) -> Result<Vec<Harvest>, AppError> {
        let harvests = sqlx::query_as::<_, Harvest>(
            r#"
            SELECT * FROM harvests
            WHERE vineyard_id = $1
            ORDER BY harvest_date DESC
            "#,
        )
            .bind(vineyard_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(harvests)
    }

    pub async fn list_by_parcel(&self, parcel_id: Uuid) -> Result<Vec<Harvest>, AppError> {
        let harvests = sqlx::query_as::<_, Harvest>(
            r#"
            SELECT * FROM harvests
            WHERE parcel_id = $1
            ORDER BY harvest_date DESC
            "#,
        )
            .bind(parcel_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(harvests)
    }

    pub async fn list_all(&self) -> Result<Vec<Harvest>, AppError> {
        let harvests = sqlx::query_as::<_, Harvest>(
            "SELECT * FROM harvests ORDER BY harvest_date DESC",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(harvests)
    }

    pub async fn update_harvest(
        &self,
        id: Uuid,
        req: UpdateHarvestRequest,
    ) -> Result<Harvest, AppError> {
        let harvest = sqlx::query_as::<_, Harvest>(
            r#"
            UPDATE harvests SET
                harvest_date       = COALESCE($2, harvest_date),
                status             = COALESCE($3, status),
                total_weight_kg    = COALESCE($4, total_weight_kg),
                yield_per_hectare  = COALESCE($5, yield_per_hectare),
                weather_condition  = COALESCE($6, weather_condition),
                temperature_celsius = COALESCE($7, temperature_celsius),
                humidity_percent   = COALESCE($8, humidity_percent),
                notes              = COALESCE($9, notes),
                updated_at         = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(req.harvest_date)
            .bind(req.status)
            .bind(req.total_weight_kg)
            .bind(req.yield_per_hectare)
            .bind(req.weather_condition)
            .bind(req.temperature_celsius)
            .bind(req.humidity_percent)
            .bind(req.notes)
            .fetch_one(&self.pool)
            .await?;

        Ok(harvest)
    }

    pub async fn update_status(&self, id: Uuid, status: HarvestStatus) -> Result<Harvest, AppError> {
        let harvest = sqlx::query_as::<_, Harvest>(
            r#"
            UPDATE harvests
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(status)
            .fetch_one(&self.pool)
            .await?;

        Ok(harvest)
    }

    pub async fn delete_harvest(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM harvests WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ============== Quality measurements ==============

    pub async fn add_quality_measurement(
        &self,
        harvest_id: Uuid,
        req: AddQualityMeasurementRequest,
    ) -> Result<HarvestQuality, AppError> {
        let quality = sqlx::query_as::<_, HarvestQuality>(
            r#"
            INSERT INTO harvest_quality (
                harvest_id, brix, ph, acidity,
                berry_size, berry_color, grape_health, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
            .bind(harvest_id)
            .bind(req.brix)
            .bind(req.ph)
            .bind(req.acidity)
            .bind(req.berry_size)
            .bind(req.berry_color)
            .bind(req.grape_health)
            .bind(req.notes)
            .fetch_one(&self.pool)
            .await?;

        Ok(quality)
    }

    pub async fn list_quality_measurements(
        &self,
        harvest_id: Uuid,
    ) -> Result<Vec<HarvestQuality>, AppError> {
        let measurements = sqlx::query_as::<_, HarvestQuality>(
            r#"
            SELECT * FROM harvest_quality
            WHERE harvest_id = $1
            ORDER BY measured_at ASC
            "#,
        )
            .bind(harvest_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(measurements)
    }

    pub async fn get_quality_measurement(
        &self,
        id: Uuid,
    ) -> Result<HarvestQuality, AppError> {
        sqlx::query_as::<_, HarvestQuality>(
            "SELECT * FROM harvest_quality WHERE id = $1",
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Quality measurement not found".to_string()),
                _ => AppError::DatabaseError(e),
            })
    }

    pub async fn delete_quality_measurement(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM harvest_quality WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ============== Statistics ==============

    pub async fn get_vineyard_stats(&self, vineyard_id: Uuid) -> Result<VineyardHarvestStats, AppError> {
        let stats = sqlx::query_as::<_, VineyardHarvestStats>(
            r#"
            SELECT
                COUNT(*)::BIGINT                        AS total_harvests,
                COALESCE(SUM(total_weight_kg), 0)       AS total_weight_kg,
                COALESCE(AVG(yield_per_hectare), 0)     AS avg_yield_per_hectare,
                COALESCE(AVG(
                    (SELECT AVG(brix) FROM harvest_quality q WHERE q.harvest_id = h.id)
                ), 0)                                   AS avg_brix,
                COALESCE(AVG(
                    (SELECT AVG(ph) FROM harvest_quality q WHERE q.harvest_id = h.id)
                ), 0)                                   AS avg_ph
            FROM harvests h
            WHERE vineyard_id = $1
              AND status = 'completed'
            "#,
        )
            .bind(vineyard_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(stats)
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VineyardHarvestStats {
    pub total_harvests: i64,
    pub total_weight_kg: f64,
    pub avg_yield_per_hectare: f64,
    pub avg_brix: f64,
    pub avg_ph: f64,
}

use serde::Serialize;
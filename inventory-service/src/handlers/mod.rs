use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, Utc};
use uuid::Uuid;
use validator::Validate;

use crate::{
    clients::ServiceClients,
    db::{round2, InventoryRepository},
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        Bottle, BottleStatus, Bottling, BottlingResponse, BottlingsQuery, BottlesPage, BottlesQuery,
        CreateBottlingRequest, InventoryStats, Provenance, StatusCounts, UpdateBottleStatusRequest,
        UserRole, BOTTLE_VOLUME_LITERS,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub repo: InventoryRepository,
    pub clients: ServiceClients,
}

/// Broj punih flaša od 0.7 L i ostatak u litrima
pub fn bottles_from_liters(liters: f64) -> (i64, f64) {
    // epsilon zbog decimalnih grešaka (npr. 1.4 / 0.7 = 1.9999999)
    let count = (liters / BOTTLE_VOLUME_LITERS + 1e-9).floor() as i64;
    let remainder = round2((liters - count as f64 * BOTTLE_VOLUME_LITERS).max(0.0));
    (count, remainder)
}

/// Godina berbe; ako batch nema berbu, godina početka fermentacije
fn vintage_of(provenance: &Provenance) -> Option<i32> {
    let date = provenance
        .harvest
        .as_ref()
        .map(|h| h.harvest_date.as_str())
        .or(provenance.fermentation.start_date.as_deref())?;
    date.get(0..4)?.parse().ok()
}

// ============== Bottlings ==============

/// Flaširanje završene fermentacije: od litara vina pravi flaše od 0.7 L
pub async fn create_bottling(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<CreateBottlingRequest>,
) -> Result<(StatusCode, Json<BottlingResponse>), AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden("Workers cannot bottle wine".to_string()));
    }
    req.validate()?;

    let batch_uuid = Uuid::parse_str(&req.batch_id)
        .map_err(|_| AppError::ValidationError("Invalid batch_id".to_string()))?;
    let batch = state.clients.get_batch(&batch_uuid.to_string(), &auth.token).await?;

    if batch.status != "completed" {
        return Err(AppError::ValidationError(
            "Fermentation must be completed before bottling".to_string(),
        ));
    }
    if req.wine_liters > batch.volume_liters + 1e-9 {
        return Err(AppError::ValidationError(format!(
            "Wine liters ({}) cannot exceed batch volume ({} L)",
            req.wine_liters, batch.volume_liters
        )));
    }
    if !state.repo.list_bottlings(Some(&batch.id)).await?.is_empty() {
        return Err(AppError::Conflict("This batch has already been bottled".to_string()));
    }

    let (bottle_count, remainder_liters) = bottles_from_liters(req.wine_liters);
    if bottle_count == 0 {
        return Err(AppError::ValidationError("Not enough wine for a single bottle".to_string()));
    }

    let provenance = state.clients.collect_provenance(&batch, &auth.token).await?;
    let vintage = vintage_of(&provenance);
    let now = Utc::now();

    let bottling_id = Uuid::new_v4().to_string();
    let lot_code = format!(
        "L{:02}-{}",
        vintage.unwrap_or_else(|| now.year()) % 100,
        batch.id.replace('-', "")[..6].to_uppercase()
    );
    let wine_name = req.wine_name.clone().unwrap_or_else(|| batch.name.clone());

    let bottling = Bottling {
        id: bottling_id.clone(),
        lot_code: lot_code.clone(),
        batch_id: batch.id.clone(),
        wine_name: wine_name.clone(),
        grape_variety: batch.grape_variety.clone(),
        vintage,
        wine_liters: round2(req.wine_liters),
        bottle_volume_liters: BOTTLE_VOLUME_LITERS,
        bottle_count,
        remainder_liters,
        notes: req.notes.clone().filter(|n| !n.trim().is_empty()),
        bottled_by: auth.claims.user_id()?.to_string(),
        bottled_at: now,
        provenance: provenance.clone(),
    };

    // Svaka flaša dobija sopstvenu kopiju kompletnog porekla
    let bottles: Vec<Bottle> = (1..=bottle_count)
        .map(|n| Bottle {
            id: Uuid::new_v4().to_string(),
            serial: format!("{}-{:05}", lot_code, n),
            number: n,
            bottling_id: bottling_id.clone(),
            lot_code: lot_code.clone(),
            wine_name: wine_name.clone(),
            grape_variety: batch.grape_variety.clone(),
            vintage,
            volume_liters: BOTTLE_VOLUME_LITERS,
            status: BottleStatus::InStock,
            bottled_at: now,
            status_changed_at: now,
            provenance: provenance.clone(),
        })
        .collect();

    state.repo.create_bottling(&bottling, &bottles).await?;
    tracing::info!(
        "Bottled batch {} into {} bottles (lot {})",
        batch.id, bottle_count, lot_code
    );

    Ok((
        StatusCode::CREATED,
        Json(BottlingResponse {
            bottling,
            counts: StatusCounts { in_stock: bottle_count, ..Default::default() },
        }),
    ))
}

pub async fn list_bottlings(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(q): Query<BottlingsQuery>,
) -> Result<Json<Vec<BottlingResponse>>, AppError> {
    let bottlings = state.repo.list_bottlings(q.batch_id.as_deref()).await?;

    let mut responses = Vec::with_capacity(bottlings.len());
    for bottling in bottlings {
        let counts = state.repo.status_counts(Some(&bottling.id)).await?;
        responses.push(BottlingResponse { bottling, counts });
    }
    Ok(Json(responses))
}

pub async fn get_bottling(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<BottlingResponse>, AppError> {
    let bottling = state.repo.find_bottling(&id).await?;
    let counts = state.repo.status_counts(Some(&bottling.id)).await?;
    Ok(Json(BottlingResponse { bottling, counts }))
}

// ============== Bottles ==============

pub async fn list_bottles(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(q): Query<BottlesQuery>,
) -> Result<Json<BottlesPage>, AppError> {
    Ok(Json(state.repo.list_bottles(&q).await?))
}

pub async fn get_bottle(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(serial): Path<String>,
) -> Result<Json<Bottle>, AppError> {
    Ok(Json(state.repo.find_bottle(&serial).await?))
}

/// Ulaz / izlaz iz skladišta (prodaja, oštećenje, povraćaj)
pub async fn update_bottle_status(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(serial): Path<String>,
    Json(req): Json<UpdateBottleStatusRequest>,
) -> Result<Json<Bottle>, AppError> {
    Ok(Json(state.repo.update_bottle_status(&serial, req.status).await?))
}

pub async fn get_stats(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<InventoryStats>, AppError> {
    Ok(Json(state.repo.stats().await?))
}

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "inventory-service"
    }))
}

#[cfg(test)]
mod tests {
    use super::bottles_from_liters;

    #[test]
    fn computes_bottles_and_remainder() {
        assert_eq!(bottles_from_liters(0.7), (1, 0.0));
        assert_eq!(bottles_from_liters(1.4), (2, 0.0));
        assert_eq!(bottles_from_liters(1000.0), (1428, 0.4));
        assert_eq!(bottles_from_liters(0.69), (0, 0.69));
        assert_eq!(bottles_from_liters(7.0), (10, 0.0));
    }
}

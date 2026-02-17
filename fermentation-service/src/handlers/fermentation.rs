use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::{
    config::Settings,
    db::FermentationRepository,
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        AddReadingRequest, BatchResponse, BatchStats, CreateBatchRequest, CreateTankRequest,
        FermentationStatus, IotReadingRequest, ReadingResponse, TankResponse, TankStatus,
        UpdateBatchRequest, UpdateTankRequest, UserRole,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub repo: FermentationRepository,
    pub settings: Settings,
}

#[derive(Debug, Deserialize)]
pub struct ReadingsQuery {
    pub limit: Option<i64>,
}

// ============================================================
// Tank handlers
// ============================================================

pub async fn create_tank(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<CreateTankRequest>,
) -> Result<(StatusCode, Json<TankResponse>), AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden("Workers cannot create tanks".to_string()));
    }

    req.validate()?;

    let tank = state.repo.create_tank(req).await?;

    Ok((StatusCode::CREATED, Json(TankResponse::from(tank))))
}

pub async fn list_tanks(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<TankResponse>>, AppError> {
    let tanks = state.repo.list_tanks().await?;

    let responses = tanks.into_iter().map(TankResponse::from).collect();

    Ok(Json(responses))
}

pub async fn list_available_tanks(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<TankResponse>>, AppError> {
    let tanks = state.repo.list_available_tanks().await?;

    let responses = tanks.into_iter().map(TankResponse::from).collect();

    Ok(Json(responses))
}

pub async fn get_tank(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(tank_id): Path<Uuid>,
) -> Result<Json<TankResponse>, AppError> {
    let tank = state.repo.find_tank_by_id(tank_id).await?;

    // Dohvati aktivan batch ako postoji
    let batches = state.repo.list_batches_by_tank(tank_id).await?;
    let active_batch_name = batches
        .iter()
        .find(|b| b.status == FermentationStatus::Active)
        .map(|b| b.name.clone());

    let mut response = TankResponse::from(tank);
    response.active_batch = active_batch_name;

    Ok(Json(response))
}

pub async fn update_tank(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(tank_id): Path<Uuid>,
    Json(req): Json<UpdateTankRequest>,
) -> Result<Json<TankResponse>, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden("Workers cannot update tanks".to_string()));
    }

    req.validate()?;

    let tank = state.repo.update_tank(tank_id, req).await?;

    Ok(Json(TankResponse::from(tank)))
}

pub async fn delete_tank(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(tank_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    if auth.claims.role != UserRole::Admin {
        return Err(AppError::Forbidden("Only admins can delete tanks".to_string()));
    }

    state.repo.delete_tank(tank_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================
// Batch handlers
// ============================================================

pub async fn create_batch(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<CreateBatchRequest>,
) -> Result<(StatusCode, Json<BatchResponse>), AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot create fermentation batches".to_string(),
        ));
    }

    req.validate()?;

    let user_id = auth.claims.user_id()?;
    let batch = state.repo.create_batch(user_id, req).await?;

    Ok((StatusCode::CREATED, Json(BatchResponse::from(batch))))
}

pub async fn list_batches(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<BatchResponse>>, AppError> {
    let batches = state.repo.list_batches().await?;

    let mut responses: Vec<BatchResponse> = vec![];
    for batch in batches {
        let batch_id = batch.id;
        let mut response = BatchResponse::from(batch);
        // Dodaj poslednje merenje
        if let Ok(Some(reading)) = state.repo.get_latest_reading(batch_id).await {
            response.latest_reading = Some(ReadingResponse::from(reading));
        }
        responses.push(response);
    }

    Ok(Json(responses))
}

pub async fn list_active_batches(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<BatchResponse>>, AppError> {
    let batches = state.repo.list_active_batches().await?;

    let mut responses: Vec<BatchResponse> = vec![];
    for batch in batches {
        let batch_id = batch.id;
        let mut response = BatchResponse::from(batch);
        if let Ok(Some(reading)) = state.repo.get_latest_reading(batch_id).await {
            response.latest_reading = Some(ReadingResponse::from(reading));
        }
        responses.push(response);
    }

    Ok(Json(responses))
}

pub async fn get_batch(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
) -> Result<Json<BatchResponse>, AppError> {
    let batch = state.repo.find_batch_by_id(batch_id).await?;

    let mut response = BatchResponse::from(batch);

    // Poslednje merenje
    if let Ok(Some(reading)) = state.repo.get_latest_reading(batch_id).await {
        response.latest_reading = Some(ReadingResponse::from(reading));
    }

    Ok(Json(response))
}

pub async fn list_batches_by_tank(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(tank_id): Path<Uuid>,
) -> Result<Json<Vec<BatchResponse>>, AppError> {
    let batches = state.repo.list_batches_by_tank(tank_id).await?;

    let responses = batches.into_iter().map(BatchResponse::from).collect();

    Ok(Json(responses))
}

pub async fn update_batch(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
    Json(req): Json<UpdateBatchRequest>,
) -> Result<Json<BatchResponse>, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot update batches".to_string(),
        ));
    }

    req.validate()?;

    let batch = state.repo.find_batch_by_id(batch_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && batch.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let updated = state.repo.update_batch(batch_id, req).await?;

    Ok(Json(BatchResponse::from(updated)))
}

pub async fn delete_batch(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot delete batches".to_string(),
        ));
    }

    let batch = state.repo.find_batch_by_id(batch_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && batch.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    state.repo.delete_batch(batch_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_batch_stats(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
) -> Result<Json<BatchStats>, AppError> {
    // Provjeri da batch postoji
    state.repo.find_batch_by_id(batch_id).await?;

    let stats = state.repo.get_batch_stats(batch_id).await?;

    Ok(Json(stats))
}

// ============================================================
// Reading handlers
// ============================================================

pub async fn add_reading(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
    Json(req): Json<AddReadingRequest>,
) -> Result<(StatusCode, Json<ReadingResponse>), AppError> {
    req.validate()?;

    // Provjeri da batch postoji i aktivan je
    let batch = state.repo.find_batch_by_id(batch_id).await?;
    if batch.status != FermentationStatus::Active {
        return Err(AppError::Conflict(
            "Can only add readings to active batches".to_string(),
        ));
    }

    let user_id = auth.claims.user_id()?;
    if auth.claims.role == UserRole::Worker && batch.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let reading = state.repo.add_reading(batch_id, req).await?;

    Ok((StatusCode::CREATED, Json(ReadingResponse::from(reading))))
}

pub async fn list_readings(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(batch_id): Path<Uuid>,
    Query(query): Query<ReadingsQuery>,
) -> Result<Json<Vec<ReadingResponse>>, AppError> {
    // Provjeri da batch postoji
    state.repo.find_batch_by_id(batch_id).await?;

    let readings = state.repo.list_readings(batch_id, query.limit).await?;

    let responses = readings.into_iter().map(ReadingResponse::from).collect();

    Ok(Json(responses))
}

pub async fn delete_reading(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path((_batch_id, reading_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot delete readings".to_string(),
        ));
    }

    state.repo.delete_reading(reading_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// IoT endpoint
pub async fn iot_reading(
    State(state): State<AppState>,
    Json(req): Json<IotReadingRequest>,
) -> Result<(StatusCode, Json<ReadingResponse>), AppError> {
    let reading = state.repo.add_iot_reading(req).await?;

    Ok((StatusCode::CREATED, Json(ReadingResponse::from(reading))))
}

// ============================================================
// Health check
// ============================================================

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "fermentation-service"
    }))
}
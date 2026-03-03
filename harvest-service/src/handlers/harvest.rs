use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use uuid::Uuid;
use validator::Validate;
use axum::http::header;
use axum::http::HeaderValue;

use crate::{
    config::Settings,
    db::{HarvestRepository, VineyardHarvestStats},
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        AddQualityMeasurementRequest, CreateHarvestRequest, HarvestQualityResponse,
        HarvestResponse, HarvestStatus, UpdateHarvestRequest, UserRole,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub harvest_repo: HarvestRepository,
    pub settings: Settings,
}

// ============== Harvest handlers ==============

/// Kreiraj novu berbu
pub async fn create_harvest(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<CreateHarvestRequest>,
) -> Result<(StatusCode, Json<HarvestResponse>), AppError> {
    // Workers ne mogu kreirati berbu
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot create harvests".to_string(),
        ));
    }

    req.validate()?;

    let user_id = auth.claims.user_id()?;
    let harvest = state.harvest_repo.create_harvest(user_id, req).await?;

    let mut response = HarvestResponse::from(harvest);
    response.quality_measurements = vec![];

    Ok((StatusCode::CREATED, Json(response)))
}

/// Dohvati berbu po ID-u (sa svim merenjima kvaliteta)
pub async fn get_harvest(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
) -> Result<Json<HarvestResponse>, AppError> {
    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;

    // Provjera pristupa
    let user_id = auth.claims.user_id()?;
    if auth.claims.role == UserRole::Worker && harvest.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let quality = state
        .harvest_repo
        .list_quality_measurements(harvest_id)
        .await?;

    let mut response = HarvestResponse::from(harvest);
    response.quality_measurements = quality
        .into_iter()
        .map(HarvestQualityResponse::from)
        .collect();

    Ok(Json(response))
}

/// Lista berbi za vinograd
pub async fn list_harvests_by_vineyard(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
) -> Result<Json<Vec<HarvestResponse>>, AppError> {
    let harvests = state.harvest_repo.list_by_vineyard(vineyard_id).await?;

    let responses = harvests.into_iter().map(HarvestResponse::from).collect();

    Ok(Json(responses))
}

/// Lista berbi za parcelu
pub async fn list_harvests_by_parcel(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(parcel_id): Path<Uuid>,
) -> Result<Json<Vec<HarvestResponse>>, AppError> {
    let harvests = state.harvest_repo.list_by_parcel(parcel_id).await?;

    let responses = harvests.into_iter().map(HarvestResponse::from).collect();

    Ok(Json(responses))
}

/// Lista svih berbi (samo admin)
pub async fn list_all_harvests(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<HarvestResponse>>, AppError> {
    if auth.claims.role != UserRole::Admin {
        return Err(AppError::Forbidden("Admin only".to_string()));
    }

    let harvests = state.harvest_repo.list_all().await?;

    let responses = harvests.into_iter().map(HarvestResponse::from).collect();

    Ok(Json(responses))
}

/// Ažuriraj berbu
pub async fn update_harvest(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
    Json(req): Json<UpdateHarvestRequest>,
) -> Result<Json<HarvestResponse>, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot update harvests".to_string(),
        ));
    }

    req.validate()?;

    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && harvest.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let updated = state.harvest_repo.update_harvest(harvest_id, req).await?;

    Ok(Json(HarvestResponse::from(updated)))
}

/// Promeni status berbe
pub async fn update_harvest_status(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<HarvestResponse>, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot change harvest status".to_string(),
        ));
    }

    let status_str = body["status"]
        .as_str()
        .ok_or_else(|| AppError::ValidationError("status field is required".to_string()))?;

    let status = match status_str {
        "planned" => HarvestStatus::Planned,
        "in_progress" => HarvestStatus::InProgress,
        "completed" => HarvestStatus::Completed,
        "cancelled" => HarvestStatus::Cancelled,
        _ => return Err(AppError::ValidationError(
            "Invalid status. Use: planned, in_progress, completed, cancelled".to_string(),
        )),
    };

    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && harvest.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let updated = state.harvest_repo.update_status(harvest_id, status).await?;

    Ok(Json(HarvestResponse::from(updated)))
}

/// Obriši berbu
pub async fn delete_harvest(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot delete harvests".to_string(),
        ));
    }

    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && harvest.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    state.harvest_repo.delete_harvest(harvest_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============== Quality measurement handlers ==============

/// Dodaj merenje kvaliteta
pub async fn add_quality_measurement(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
    Json(req): Json<AddQualityMeasurementRequest>,
) -> Result<(StatusCode, Json<HarvestQualityResponse>), AppError> {
    req.validate()?;

    // Provjera da berba postoji i pristupa
    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role == UserRole::Worker && harvest.created_by != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let quality = state
        .harvest_repo
        .add_quality_measurement(harvest_id, req)
        .await?;

    Ok((StatusCode::CREATED, Json(HarvestQualityResponse::from(quality))))
}

/// Lista merenja kvaliteta za berbu
pub async fn list_quality_measurements(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
) -> Result<Json<Vec<HarvestQualityResponse>>, AppError> {
    // Provjera da berba postoji
    state.harvest_repo.find_by_id(harvest_id).await?;

    let measurements = state
        .harvest_repo
        .list_quality_measurements(harvest_id)
        .await?;

    let responses = measurements
        .into_iter()
        .map(HarvestQualityResponse::from)
        .collect();

    Ok(Json(responses))
}

/// Obriši merenje kvaliteta
pub async fn delete_quality_measurement(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path((_harvest_id, measurement_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot delete quality measurements".to_string(),
        ));
    }

    // Provjera da merenje postoji
    state.harvest_repo.get_quality_measurement(measurement_id).await?;

    state
        .harvest_repo
        .delete_quality_measurement(measurement_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============== Stats handler ==============

/// Statistike berbi za vinograd
pub async fn get_vineyard_harvest_stats(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
) -> Result<Json<VineyardHarvestStats>, AppError> {
    let stats = state.harvest_repo.get_vineyard_stats(vineyard_id).await?;

    Ok(Json(stats))
}
pub async fn export_harvest_pdf(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(harvest_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    // Get harvest
    let harvest = state.harvest_repo.find_by_id(harvest_id).await?;

    // Check ownership
    if harvest.created_by != auth.claims.user_id()? && auth.claims.role != UserRole::Admin {
        return Err(AppError::Forbidden(
            "You can only export your own harvests".to_string(),
        ));
    }

    // Get quality measurements
    let quality_measurements = state
        .harvest_repo
        .list_quality_measurements(harvest_id)
        .await
        .unwrap_or_default();

    // Get vineyard and parcel names (simplified - you may need to call vineyard service)
    let vineyard_name = "Vineyard"; // TODO: Fetch from vineyard service via HTTP
    let parcel_name = "Parcel"; // TODO: Fetch from vineyard service via HTTP

    // Generate PDF
    let pdf_bytes = crate::pdf::generate_harvest_report(
        &harvest,
        &quality_measurements,
        vineyard_name,
        parcel_name,
    )
        .map_err(|e| AppError::InternalError(format!("Failed to generate PDF: {}", e)))?;

    // Return PDF
    let filename = format!(
        "harvest_report_{}.pdf",
        harvest.harvest_date.format("%Y%m%d")
    );

    let content_disposition = format!("attachment; filename=\"{}\"", filename);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, HeaderValue::from_static("application/pdf")),
            (
                header::CONTENT_DISPOSITION,
                HeaderValue::from_str(&content_disposition).unwrap(),
            ),
        ],
        pdf_bytes,
    ))
}
/// Health check
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "harvest-service"
    }))
}
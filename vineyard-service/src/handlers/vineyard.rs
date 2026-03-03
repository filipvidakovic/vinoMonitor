use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    config::Settings,
    db::VineyardRepository,
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        CreateParcelRequest, CreateVineyardRequest, ParcelResponse, UpdateParcelRequest,
        UpdateVineyardRequest, UserRole, VineyardResponse,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub vineyard_repo: VineyardRepository,
    pub settings: Settings,
}


pub async fn create_vineyard(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<CreateVineyardRequest>,
) -> Result<(StatusCode, Json<VineyardResponse>), AppError> {

    if auth.claims.role != UserRole::Winemaker && auth.claims.role != UserRole::Admin {
        return Err(AppError::Forbidden(
            "Only winemakers and admins can create vineyards".to_string(),
        ));
    }

    req.validate()?;

    let user_id = auth.claims.user_id()?;
    let vineyard = state.vineyard_repo.create_vineyard(user_id, req).await?;

    Ok((StatusCode::CREATED, Json(VineyardResponse::from(vineyard))))
}

pub async fn get_vineyard(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
) -> Result<Json<VineyardResponse>, AppError> {
    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;

    let user_id = auth.claims.user_id()?;
    if auth.claims.role == UserRole::Worker && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcel_count = state
        .vineyard_repo
        .get_parcel_count(vineyard_id)
        .await
        .ok();

    let mut response = VineyardResponse::from(vineyard);
    response.parcel_count = parcel_count;

    Ok(Json(response))
}

pub async fn list_vineyards(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<VineyardResponse>>, AppError> {
    let vineyards = if auth.claims.role == UserRole::Admin {
        state.vineyard_repo.list_all_vineyards().await?
    } else {
        let user_id = auth.claims.user_id()?;
        state.vineyard_repo.list_vineyards_by_owner(user_id).await?
    };

    let responses: Vec<VineyardResponse> = vineyards
        .into_iter()
        .map(VineyardResponse::from)
        .collect();

    Ok(Json(responses))
}

pub async fn update_vineyard(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
    Json(req): Json<UpdateVineyardRequest>,
) -> Result<Json<VineyardResponse>, AppError> {
    req.validate()?;

    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let updated_vineyard = state
        .vineyard_repo
        .update_vineyard(vineyard_id, req)
        .await?;

    Ok(Json(VineyardResponse::from(updated_vineyard)))
}

pub async fn delete_vineyard(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    state.vineyard_repo.delete_vineyard(vineyard_id).await?;

    Ok(StatusCode::NO_CONTENT)
}


pub async fn create_parcel(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
    Json(req): Json<CreateParcelRequest>,
) -> Result<(StatusCode, Json<ParcelResponse>), AppError> {
    req.validate()?;

    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcel = state
        .vineyard_repo
        .create_parcel(vineyard_id, req)
        .await?;

    Ok((StatusCode::CREATED, Json(ParcelResponse::from(parcel))))
}

pub async fn get_parcel(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path((vineyard_id, parcel_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ParcelResponse>, AppError> {
    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role == UserRole::Worker && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcel = state.vineyard_repo.find_parcel_by_id(parcel_id).await?;

    if parcel.vineyard_id != vineyard_id {
        return Err(AppError::NotFound("Parcel not found in this vineyard".to_string()));
    }

    Ok(Json(ParcelResponse::from(parcel)))
}

pub async fn list_parcels(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(vineyard_id): Path<Uuid>,
) -> Result<Json<Vec<ParcelResponse>>, AppError> {
    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role == UserRole::Worker && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcels = state
        .vineyard_repo
        .list_parcels_by_vineyard(vineyard_id)
        .await?;

    let responses: Vec<ParcelResponse> = parcels
        .into_iter()
        .map(ParcelResponse::from)
        .collect();

    Ok(Json(responses))
}

pub async fn update_parcel(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path((vineyard_id, parcel_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateParcelRequest>,
) -> Result<Json<ParcelResponse>, AppError> {
    req.validate()?;

    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcel = state.vineyard_repo.find_parcel_by_id(parcel_id).await?;
    if parcel.vineyard_id != vineyard_id {
        return Err(AppError::NotFound("Parcel not found in this vineyard".to_string()));
    }

    let updated_parcel = state.vineyard_repo.update_parcel(parcel_id, req).await?;

    Ok(Json(ParcelResponse::from(updated_parcel)))
}

pub async fn delete_parcel(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path((vineyard_id, parcel_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let vineyard = state.vineyard_repo.find_vineyard_by_id(vineyard_id).await?;
    let user_id = auth.claims.user_id()?;

    if auth.claims.role != UserRole::Admin && vineyard.owner_id != user_id {
        return Err(AppError::Forbidden("Access denied".to_string()));
    }

    let parcel = state.vineyard_repo.find_parcel_by_id(parcel_id).await?;
    if parcel.vineyard_id != vineyard_id {
        return Err(AppError::NotFound("Parcel not found in this vineyard".to_string()));
    }

    state.vineyard_repo.delete_parcel(parcel_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "vineyard-service"
    }))
}
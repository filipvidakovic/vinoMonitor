use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};

use crate::{
    db::IotRepository,
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        Device, DeviceCommand, DeviceStatus, LatestQuery, ReadingStats, ReadingsQuery,
        SensorReading, SeriesPoint, SeriesQuery, StatsQuery, UserRole,
    },
    mqtt::MqttHandle,
};

#[derive(Clone)]
pub struct AppState {
    pub repo: IotRepository,
    pub mqtt: MqttHandle,
}

// ============== Devices ==============

pub async fn list_devices(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Device>>, AppError> {
    Ok(Json(state.repo.list_devices().await?))
}

pub async fn get_device(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(device_id): Path<String>,
) -> Result<Json<Device>, AppError> {
    Ok(Json(state.repo.find_device(&device_id).await?))
}

/// Šalje komandu uređaju preko MQTT-a
pub async fn send_command(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Path(device_id): Path<String>,
    Json(command): Json<DeviceCommand>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    if auth.claims.role == UserRole::Worker {
        return Err(AppError::Forbidden(
            "Workers cannot send device commands".to_string(),
        ));
    }

    command.validate().map_err(AppError::ValidationError)?;

    let device = state.repo.find_device(&device_id).await?;
    if device.status == DeviceStatus::Offline {
        return Err(AppError::ValidationError("Device is offline".to_string()));
    }

    state.mqtt.send_command(&device_id, &command).await?;

    Ok((
        StatusCode::ACCEPTED,
        Json(serde_json::json!({ "device_id": device_id, "command": command })),
    ))
}

// ============== Readings ==============

pub async fn list_readings(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(query): Query<ReadingsQuery>,
) -> Result<Json<Vec<SensorReading>>, AppError> {
    Ok(Json(state.repo.list_readings(&query).await?))
}

pub async fn latest_readings(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(query): Query<LatestQuery>,
) -> Result<Json<Vec<SensorReading>>, AppError> {
    Ok(Json(state.repo.latest_readings(query.target_type).await?))
}

pub async fn reading_series(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(q): Query<SeriesQuery>,
) -> Result<Json<Vec<SeriesPoint>>, AppError> {
    Ok(Json(
        state
            .repo
            .series(q.target_type, q.target_id, q.from, q.to, q.bucket_minutes)
            .await?,
    ))
}

pub async fn reading_stats(
    _auth: AuthenticatedUser,
    State(state): State<AppState>,
    Query(q): Query<StatsQuery>,
) -> Result<Json<ReadingStats>, AppError> {
    Ok(Json(
        state
            .repo
            .stats(q.target_type, q.target_id, q.from, q.to)
            .await?,
    ))
}

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "iot-service"
    }))
}

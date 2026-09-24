use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Token error: {0}")]
    TokenError(#[from] jsonwebtoken::errors::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("MQTT error: {0}")]
    MqttError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::DatabaseError(e) => {
                tracing::error!("DB error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
            }
            AppError::ValidationError(m) => (StatusCode::BAD_REQUEST, m.as_str()),
            AppError::TokenError(_) => (StatusCode::UNAUTHORIZED, "Invalid or expired token"),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.as_str()),
            AppError::InternalError(m) => {
                tracing::error!("Internal error: {}", m);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.as_str()),
            AppError::Forbidden(m) => (StatusCode::FORBIDDEN, m.as_str()),
            AppError::MqttError(m) => {
                tracing::error!("MQTT error: {}", m);
                (StatusCode::SERVICE_UNAVAILABLE, "MQTT broker unavailable")
            }
        };

        (status, Json(json!({ "error": message, "status": status.as_u16() }))).into_response()
    }
}

impl From<validator::ValidationErrors> for AppError {
    fn from(e: validator::ValidationErrors) -> Self {
        AppError::ValidationError(e.to_string())
    }
}

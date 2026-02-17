use axum::{Router, routing::post};
use sqlx::PgPool;
use crate::{handlers::auth_handler, config::Settings};
use crate::handlers::auth_handler::AppState;

pub fn create_router(app_state: AppState) -> Router {
    Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login))
        .with_state(app_state)
}

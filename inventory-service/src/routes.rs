use axum::{
    middleware,
    routing::{get, patch},
    Router,
};

use crate::{config::Settings, handlers::{self, AppState}};

pub fn create_router(state: AppState, settings: Settings) -> Router {
    // Public routes
    let public_routes = Router::new()
        .route("/health", get(handlers::health_check));

    // Protected routes
    let protected_routes = Router::new()
        // Flaširanje (lotovi)
        .route("/bottlings", get(handlers::list_bottlings).post(handlers::create_bottling))
        .route("/bottlings/:bottling_id", get(handlers::get_bottling))
        // Flaše
        .route("/bottles", get(handlers::list_bottles))
        .route("/bottles/:serial", get(handlers::get_bottle))
        .route("/bottles/:serial/status", patch(handlers::update_bottle_status))
        // Stanje skladišta
        .route("/stats", get(handlers::get_stats))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::add_settings(settings.clone(), req, next)
        }));

    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .with_state(state)
}

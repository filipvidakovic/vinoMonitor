use axum::{
    middleware,
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::{config::Settings, handlers::{self, AppState}};

pub fn create_router(state: AppState, settings: Settings) -> Router {
    // Public routes (health check + IoT endpoint bez JWT)
    let public_routes = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/iot/readings", post(handlers::iot_reading));

    // Protected routes
    let protected_routes = Router::new()
        // Tanks
        .route("/tanks", post(handlers::create_tank))
        .route("/tanks", get(handlers::list_tanks))
        .route("/tanks/available", get(handlers::list_available_tanks))
        .route("/tanks/:tank_id", get(handlers::get_tank))
        .route("/tanks/:tank_id", put(handlers::update_tank))
        .route("/tanks/:tank_id", delete(handlers::delete_tank))
        .route("/tanks/:tank_id/batches", get(handlers::list_batches_by_tank))
        // Batches
        .route("/batches", post(handlers::create_batch))
        .route("/batches", get(handlers::list_batches))
        .route("/batches/active", get(handlers::list_active_batches))
        .route("/batches/:batch_id", get(handlers::get_batch))
        .route("/batches/:batch_id", put(handlers::update_batch))
        .route("/batches/:batch_id", delete(handlers::delete_batch))
        .route("/batches/:batch_id/stats", get(handlers::get_batch_stats))
        // Readings
        .route("/batches/:batch_id/readings", post(handlers::add_reading))
        .route("/batches/:batch_id/readings", get(handlers::list_readings))
        .route("/batches/:batch_id/readings/:reading_id", delete(handlers::delete_reading))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::add_settings(settings.clone(), req, next)
        }));

    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .with_state(state)
}
use axum::{
    middleware,
    routing::{get, post},
    Router,
};

use crate::{config::Settings, handlers::{self, AppState}};

pub fn create_router(state: AppState, settings: Settings) -> Router {
    // Public routes (uređaji ne koriste HTTP, šalju preko MQTT-a)
    let public_routes = Router::new()
        .route("/health", get(handlers::health_check));

    // Protected routes
    let protected_routes = Router::new()
        // Devices
        .route("/devices", get(handlers::list_devices))
        .route("/devices/:device_id", get(handlers::get_device))
        .route("/devices/:device_id/commands", post(handlers::send_command))
        // Readings
        .route("/readings", get(handlers::list_readings))
        .route("/readings/latest", get(handlers::latest_readings))
        .route("/readings/stats", get(handlers::reading_stats))
        .route("/readings/series", get(handlers::reading_series))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::add_settings(settings.clone(), req, next)
        }));

    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .with_state(state)
}

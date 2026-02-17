use axum::{
    middleware,
    routing::{delete, get, patch, post, put},
    Router,
};

use crate::{
    config::Settings,
    handlers::{self, AppState},
};

pub fn create_router(state: AppState, settings: Settings) -> Router {
    let public_routes = Router::new()
        .route("/health", get(handlers::health_check));

    let protected_routes = Router::new()
        // Harvests
        .route("/harvests", post(handlers::create_harvest))
        .route("/harvests", get(handlers::list_all_harvests))
        .route("/harvests/:harvest_id", get(handlers::get_harvest))
        .route("/harvests/:harvest_id", put(handlers::update_harvest))
        .route("/harvests/:harvest_id/status", patch(handlers::update_harvest_status))
        .route("/harvests/:harvest_id", delete(handlers::delete_harvest))
        // Quality measurements
        .route("/harvests/:harvest_id/quality", post(handlers::add_quality_measurement))
        .route("/harvests/:harvest_id/quality", get(handlers::list_quality_measurements))
        .route("/harvests/:harvest_id/quality/:measurement_id", delete(handlers::delete_quality_measurement))
        // Queries by vineyard / parcel
        .route("/vineyards/:vineyard_id/harvests", get(handlers::list_harvests_by_vineyard))
        .route("/vineyards/:vineyard_id/stats", get(handlers::get_vineyard_harvest_stats))
        .route("/parcels/:parcel_id/harvests", get(handlers::list_harvests_by_parcel))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::add_settings(settings.clone(), req, next)
        }));

    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .with_state(state)
}
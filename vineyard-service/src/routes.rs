use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};

use crate::{config::Settings, handlers::{self, AppState}};

pub fn create_router(state: AppState, settings: Settings) -> Router {
    // Public routes
    let public_routes = Router::new()
        .route("/health", get(handlers::health_check));

    // Protected vineyard routes
    let vineyard_routes = Router::new()
        .route("/vineyards", post(handlers::create_vineyard))
        .route("/vineyards", get(handlers::list_vineyards))
        .route("/vineyards/:vineyard_id", get(handlers::get_vineyard))
        .route("/vineyards/:vineyard_id", put(handlers::update_vineyard))
        .route("/vineyards/:vineyard_id", delete(handlers::delete_vineyard))
        // Parcel routes
        .route("/vineyards/:vineyard_id/parcels", post(handlers::create_parcel))
        .route("/vineyards/:vineyard_id/parcels", get(handlers::list_parcels))
        .route("/vineyards/:vineyard_id/parcels/:parcel_id", get(handlers::get_parcel))
        .route("/vineyards/:vineyard_id/parcels/:parcel_id", put(handlers::update_parcel))
        .route("/vineyards/:vineyard_id/parcels/:parcel_id", delete(handlers::delete_parcel))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::add_settings(settings.clone(), req, next)
        }));

    // Combine routes
    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", vineyard_routes)
        .with_state(state)
}
use axum::{Router, middleware, routing::post, routing::get, routing::put};
use sqlx::PgPool;
use crate::{handlers::auth_handler, config::Settings};
use crate::handlers::auth_handler::AppState;


pub fn create_router(state: AppState, settings: Settings) -> Router {
    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/auth/register", post(auth_handler::register))
        .route("/auth/login", post(auth_handler::login))
        .route("/auth/health", get(auth_handler::health_check));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/user/profile", get(auth_handler::get_profile))
        .route("/user/profile", put(auth_handler::update_profile))
        .route("/user/password", put(auth_handler::change_password))
        .route("/user/list", get(auth_handler::list_users))
        .layer(middleware::from_fn(move |req, next| {
            crate::middleware::settings::add_settings(settings.clone(), req, next)
        }));

    // Combine routes
    Router::new()
        .nest("/api/v1", public_routes)
        .nest("/api/v1", protected_routes)
        .with_state(state)
}

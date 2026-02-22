mod config;
mod db;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod routes;
mod utils;
mod error;

use std::net::SocketAddr;

use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Settings,
    db::{create_pool, run_migrations, UserRepository},
    handlers::auth_handler::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "auth_service=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let settings = Settings::from_env()?;
    tracing::info!("Configuration loaded successfully");

    // Create database pool
    let pool = create_pool(&settings.database_url).await?;
    tracing::info!("Database pool created");

    // Run migrations
    run_migrations(&pool).await?;
    tracing::info!("Database migrations completed");

    // Create repositories
    let user_repo = UserRepository::new(pool.clone());

    // Create app state
    let app_state = AppState {
        user_repo,
        settings: settings.clone(),
    };

    // Create router
    let app = routes::create_router(app_state, settings.clone())
        .layer(
            CorsLayer::new()
                .allow_origin(
                    settings
                        .allowed_origins
                        .iter()
                        .map(|origin| origin.parse().unwrap())
                        .collect::<Vec<_>>(),
                )
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    // Start server
    let addr: SocketAddr = settings.server_address().parse()?;
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
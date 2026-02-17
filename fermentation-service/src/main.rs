mod config;
mod db;
mod error;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod routes;

use std::net::SocketAddr;

use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Settings,
    db::{create_pool, run_migrations, FermentationRepository},
    handlers::AppState,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "fermentation_service=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let settings = Settings::from_env()?;
    tracing::info!("Configuration loaded");

    let pool = create_pool(&settings.database_url).await?;
    tracing::info!("Database pool created");

    run_migrations(&pool).await?;
    tracing::info!("Migrations completed");

    let repo = FermentationRepository::new(pool);

    let app_state = AppState {
        repo,
        settings: settings.clone(),
    };

    let app = routes::create_router(app_state, settings.clone())
        .layer(
            CorsLayer::new()
                .allow_origin(
                    settings
                        .allowed_origins
                        .iter()
                        .map(|o| o.parse().unwrap())
                        .collect::<Vec<_>>(),
                )
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = settings.server_address().parse()?;
    tracing::info!("Starting Fermentation Service on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
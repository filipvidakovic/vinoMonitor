mod clients;
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

use crate::{clients::ServiceClients, config::Settings, db::InventoryRepository, handlers::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "inventory_service=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let settings = Settings::from_env()?;
    tracing::info!("Configuration loaded");

    let repo = InventoryRepository::connect(&settings.mongodb_uri, &settings.mongodb_db).await?;
    tracing::info!("Connected to MongoDB, indexes ready");

    let app_state = AppState {
        repo,
        clients: ServiceClients::new(&settings),
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
    tracing::info!("Starting Inventory Service on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

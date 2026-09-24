mod config;
mod db;
mod error;
mod extractors;
mod handlers;
mod middleware;
mod models;
mod mqtt;
mod routes;

use std::net::SocketAddr;

use tower_http::{cors::{Any, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    config::Settings,
    db::{create_pool, run_migrations, IotRepository},
    handlers::AppState,
    mqtt::FermentationForwarder,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "iot_service=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let settings = Settings::from_env()?;
    tracing::info!("Configuration loaded");

    let pool = create_pool(&settings.database_url).await?;
    tracing::info!("Database pool created");

    run_migrations(&pool).await?;
    tracing::info!("Migrations completed");

    let repo = IotRepository::new(pool);

    let forwarder = settings.fermentation_service_url.clone().map(|url| {
        tracing::info!("Forwarding tank temperatures to {}", url);
        FermentationForwarder::new(url, settings.fermentation_forward_interval_secs)
    });

    let mqtt = mqtt::start(&settings, repo.clone(), forwarder);
    tracing::info!(
        "MQTT listener started ({}:{})",
        settings.mqtt_host,
        settings.mqtt_port
    );

    let app_state = AppState { repo, mqtt };

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
    tracing::info!("Starting IoT Service on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

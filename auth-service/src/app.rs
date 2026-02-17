use axum::Router;
use crate::{config::Config, db, router::create_router};

pub async fn build_app() -> Router {
    let config = Config::from_env();
    let pool = db::connect(&config.database_url).await;

    create_router(pool, config)
}

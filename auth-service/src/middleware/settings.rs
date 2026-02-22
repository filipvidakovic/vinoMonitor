use axum::{extract::Request, middleware::Next, response::Response};

use crate::config::Settings;

pub async fn add_settings(settings: Settings, mut request: Request, next: Next) -> Response {
    request.extensions_mut().insert(settings);
    next.run(request).await
}
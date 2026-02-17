use axum::{async_trait, extract::FromRequestParts, http::request::Parts, RequestPartsExt};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

use crate::{config::Settings, error::AppError, models::Claims};

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub claims: Claims,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AppError::Unauthorized("Missing authorization token".to_string()))?;

        let settings = parts
            .extensions
            .get::<Settings>()
            .ok_or_else(|| AppError::InternalError("Settings not found".to_string()))?;

        let claims = Claims::decode(bearer.token(), &settings.jwt_secret)?;

        Ok(AuthenticatedUser { claims })
    }
}
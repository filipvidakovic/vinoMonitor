use axum::{extract::State, http::StatusCode, Json};
use validator::Validate;

use crate::{
    config::Settings,
    db::UserRepository,
    error::AppError,
    extractors::AuthenticatedUser,
    models::{
        ChangePasswordRequest, Claims, LoginRequest, LoginResponse, RegisterRequest,
        UpdateProfileRequest, UserResponse, UserRole,
    },
    utils::{hash_password, verify_password},
};

#[derive(Clone)]
pub struct AppState {
    pub user_repo: UserRepository,
    pub settings: Settings,
}

/// Register a new user
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<UserResponse>), AppError> {
    // Validate request
    req.validate()?;

    // Create user
    let user = state.user_repo.create_user(req).await?;

    Ok((StatusCode::CREATED, Json(UserResponse::from(user))))
}

/// Login user and return JWT token
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    // Validate request
    req.validate()?;

    // Find user by email
    let user = state
        .user_repo
        .find_by_email(&req.email)
        .await
        .map_err(|_| AppError::AuthenticationError("Invalid credentials".to_string()))?;

    // Check if user is active
    if !user.is_active {
        return Err(AppError::AuthenticationError(
            "Account is deactivated".to_string(),
        ));
    }

    // Verify password
    let is_valid = verify_password(&req.password, &user.password_hash)?;
    if !is_valid {
        return Err(AppError::AuthenticationError(
            "Invalid credentials".to_string(),
        ));
    }

    // Generate JWT token
    let claims = Claims::new(
        user.id,
        user.email.clone(),
        user.role.clone(),
        state.settings.jwt_expiration_hours,
    );
    let token = claims.encode(&state.settings.jwt_secret)?;

    let response = LoginResponse {
        token,
        user: UserResponse::from(user),
    };

    Ok(Json(response))
}

/// Get current user profile
pub async fn get_profile(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<UserResponse>, AppError> {
    let user_id = auth.claims.user_id()?;
    let user = state.user_repo.find_by_id(user_id).await?;

    Ok(Json(UserResponse::from(user)))
}

/// Update user profile
pub async fn update_profile(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, AppError> {
    // Validate request
    req.validate()?;

    let user_id = auth.claims.user_id()?;
    let user = state.user_repo.update_user(user_id, req).await?;

    Ok(Json(UserResponse::from(user)))
}

/// Change user password
pub async fn change_password(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Validate request
    req.validate()?;

    let user_id = auth.claims.user_id()?;
    let user = state.user_repo.find_by_id(user_id).await?;

    // Verify current password
    let is_valid = verify_password(&req.current_password, &user.password_hash)?;
    if !is_valid {
        return Err(AppError::AuthenticationError(
            "Current password is incorrect".to_string(),
        ));
    }

    // Hash new password
    let new_password_hash = hash_password(&req.new_password)?;

    // Update password
    state
        .user_repo
        .update_password(user_id, &new_password_hash)
        .await?;

    Ok(Json(serde_json::json!({
        "message": "Password changed successfully"
    })))
}

/// List all users (Admin only)
pub async fn list_users(
    auth: AuthenticatedUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<UserResponse>>, AppError> {
    // Check if user is admin
    if auth.claims.role != UserRole::Admin {
        return Err(AppError::Forbidden(
            "Insufficient permissions".to_string(),
        ));
    }

    let users = state.user_repo.list_users().await?;
    let user_responses: Vec<UserResponse> = users.into_iter().map(UserResponse::from).collect();

    Ok(Json(user_responses))
}

/// Health check endpoint
pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "auth-service"
    }))
}
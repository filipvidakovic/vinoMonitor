use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::user::{RegisterRequest, UpdateProfileRequest, User};
use crate::utils::hash_password;

#[derive(Clone)]
pub struct UserRepository {
    pool: PgPool,
}

impl UserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_user(&self, req: RegisterRequest) -> Result<User, AppError> {
        let password_hash = hash_password(&req.password)?;

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
            .bind(&req.email)
            .bind(&password_hash)
            .bind(&req.first_name)
            .bind(&req.last_name)
            .bind(&req.role)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                    AppError::Conflict("Email already exists".to_string())
                }
                _ => AppError::DatabaseError(e),
            })?;

        Ok(user)
    }

    pub async fn find_by_email(&self, email: &str) -> Result<User, AppError> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users
            WHERE email = $1
            "#,
        )
            .bind(email)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("User not found".to_string()),
                _ => AppError::DatabaseError(e),
            })?;

        Ok(user)
    }

    pub async fn find_by_id(&self, user_id: Uuid) -> Result<User, AppError> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users
            WHERE id = $1
            "#,
        )
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("User not found".to_string()),
                _ => AppError::DatabaseError(e),
            })?;

        Ok(user)
    }

    pub async fn update_user(
        &self,
        user_id: Uuid,
        req: UpdateProfileRequest,
    ) -> Result<User, AppError> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET
                first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(user_id)
            .bind(req.first_name)
            .bind(req.last_name)
            .fetch_one(&self.pool)
            .await?;

        Ok(user)
    }

    pub async fn update_password(
        &self,
        user_id: Uuid,
        new_password_hash: &str,
    ) -> Result<(), AppError> {
        sqlx::query(
            r#"
            UPDATE users
            SET password_hash = $2, updated_at = NOW()
            WHERE id = $1
            "#,
        )
            .bind(user_id)
            .bind(new_password_hash)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn deactivate_user(&self, user_id: Uuid) -> Result<(), AppError> {
        sqlx::query(
            r#"
            UPDATE users
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
            "#,
        )
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn list_users(&self) -> Result<Vec<User>, AppError> {
        let users = sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users
            ORDER BY created_at DESC
            "#,
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(users)
    }
}
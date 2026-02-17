use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    CreateParcelRequest, CreateVineyardRequest, Parcel, UpdateParcelRequest,
    UpdateVineyardRequest, Vineyard,
};

#[derive(Clone)]
pub struct VineyardRepository {
    pool: PgPool,
}

impl VineyardRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // Vineyard operations
    pub async fn create_vineyard(
        &self,
        owner_id: Uuid,
        req: CreateVineyardRequest,
    ) -> Result<Vineyard, AppError> {
        let vineyard = sqlx::query_as::<_, Vineyard>(
            r#"
            INSERT INTO vineyards (owner_id, name, location, total_area, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
            .bind(owner_id)
            .bind(&req.name)
            .bind(&req.location)
            .bind(req.total_area)
            .bind(&req.description)
            .fetch_one(&self.pool)
            .await?;

        Ok(vineyard)
    }

    pub async fn find_vineyard_by_id(&self, id: Uuid) -> Result<Vineyard, AppError> {
        let vineyard = sqlx::query_as::<_, Vineyard>(
            r#"
            SELECT * FROM vineyards
            WHERE id = $1
            "#,
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Vineyard not found".to_string()),
                _ => AppError::DatabaseError(e),
            })?;

        Ok(vineyard)
    }

    pub async fn list_vineyards_by_owner(&self, owner_id: Uuid) -> Result<Vec<Vineyard>, AppError> {
        let vineyards = sqlx::query_as::<_, Vineyard>(
            r#"
            SELECT * FROM vineyards
            WHERE owner_id = $1
            ORDER BY created_at DESC
            "#,
        )
            .bind(owner_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(vineyards)
    }

    pub async fn list_all_vineyards(&self) -> Result<Vec<Vineyard>, AppError> {
        let vineyards = sqlx::query_as::<_, Vineyard>(
            r#"
            SELECT * FROM vineyards
            ORDER BY created_at DESC
            "#,
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(vineyards)
    }

    pub async fn update_vineyard(
        &self,
        id: Uuid,
        req: UpdateVineyardRequest,
    ) -> Result<Vineyard, AppError> {
        let vineyard = sqlx::query_as::<_, Vineyard>(
            r#"
            UPDATE vineyards
            SET
                name = COALESCE($2, name),
                location = COALESCE($3, location),
                total_area = COALESCE($4, total_area),
                description = COALESCE($5, description),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(req.name)
            .bind(req.location)
            .bind(req.total_area)
            .bind(req.description)
            .fetch_one(&self.pool)
            .await?;

        Ok(vineyard)
    }

    pub async fn delete_vineyard(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query(
            r#"
            DELETE FROM vineyards
            WHERE id = $1
            "#,
        )
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // Parcel operations
    pub async fn create_parcel(
        &self,
        vineyard_id: Uuid,
        req: CreateParcelRequest,
    ) -> Result<Parcel, AppError> {
        let parcel = sqlx::query_as::<_, Parcel>(
            r#"
            INSERT INTO parcels (
                vineyard_id, name, area, grape_variety,
                planting_year, soil_type, latitude, longitude
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            "#,
        )
            .bind(vineyard_id)
            .bind(&req.name)
            .bind(req.area)
            .bind(&req.grape_variety)
            .bind(req.planting_year)
            .bind(&req.soil_type)
            .bind(req.latitude)
            .bind(req.longitude)
            .fetch_one(&self.pool)
            .await?;

        Ok(parcel)
    }

    pub async fn find_parcel_by_id(&self, id: Uuid) -> Result<Parcel, AppError> {
        let parcel = sqlx::query_as::<_, Parcel>(
            r#"
            SELECT * FROM parcels
            WHERE id = $1
            "#,
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Parcel not found".to_string()),
                _ => AppError::DatabaseError(e),
            })?;

        Ok(parcel)
    }

    pub async fn list_parcels_by_vineyard(&self, vineyard_id: Uuid) -> Result<Vec<Parcel>, AppError> {
        let parcels = sqlx::query_as::<_, Parcel>(
            r#"
            SELECT * FROM parcels
            WHERE vineyard_id = $1
            ORDER BY created_at DESC
            "#,
        )
            .bind(vineyard_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(parcels)
    }

    pub async fn update_parcel(
        &self,
        id: Uuid,
        req: UpdateParcelRequest,
    ) -> Result<Parcel, AppError> {
        let parcel = sqlx::query_as::<_, Parcel>(
            r#"
            UPDATE parcels
            SET
                name = COALESCE($2, name),
                area = COALESCE($3, area),
                grape_variety = COALESCE($4, grape_variety),
                planting_year = COALESCE($5, planting_year),
                soil_type = COALESCE($6, soil_type),
                latitude = COALESCE($7, latitude),
                longitude = COALESCE($8, longitude),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(req.name)
            .bind(req.area)
            .bind(req.grape_variety)
            .bind(req.planting_year)
            .bind(req.soil_type)
            .bind(req.latitude)
            .bind(req.longitude)
            .fetch_one(&self.pool)
            .await?;

        Ok(parcel)
    }

    pub async fn delete_parcel(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query(
            r#"
            DELETE FROM parcels
            WHERE id = $1
            "#,
        )
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_parcel_count(&self, vineyard_id: Uuid) -> Result<i64, AppError> {
        let count: (i64,) = sqlx::query_as(
            r#"
            SELECT COUNT(*) FROM parcels
            WHERE vineyard_id = $1
            "#,
        )
            .bind(vineyard_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(count.0)
    }
}
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    AddReadingRequest, BatchStats, CreateBatchRequest, CreateTankRequest,
    FermentationBatch, FermentationReading, FermentationStatus, IotReadingRequest,
    Tank, TankStatus, UpdateBatchRequest, UpdateTankRequest,
};

#[derive(Clone)]
pub struct FermentationRepository {
    pool: PgPool,
}

impl FermentationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============== Tank CRUD ==============

    pub async fn create_tank(&self, req: CreateTankRequest) -> Result<Tank, AppError> {
        let tank = sqlx::query_as::<_, Tank>(
            r#"
            INSERT INTO tanks (name, capacity_liters, material, location, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
            .bind(&req.name)
            .bind(req.capacity_liters)
            .bind(&req.material)
            .bind(&req.location)
            .bind(&req.notes)
            .fetch_one(&self.pool)
            .await?;

        Ok(tank)
    }

    pub async fn find_tank_by_id(&self, id: Uuid) -> Result<Tank, AppError> {
        sqlx::query_as::<_, Tank>("SELECT * FROM tanks WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Tank not found".to_string()),
                _ => AppError::DatabaseError(e),
            })
    }

    pub async fn list_tanks(&self) -> Result<Vec<Tank>, AppError> {
        let tanks = sqlx::query_as::<_, Tank>(
            "SELECT * FROM tanks ORDER BY name ASC",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(tanks)
    }

    pub async fn list_available_tanks(&self) -> Result<Vec<Tank>, AppError> {
        let tanks = sqlx::query_as::<_, Tank>(
            "SELECT * FROM tanks WHERE status = 'available' ORDER BY name ASC",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(tanks)
    }

    pub async fn update_tank(&self, id: Uuid, req: UpdateTankRequest) -> Result<Tank, AppError> {
        let tank = sqlx::query_as::<_, Tank>(
            r#"
            UPDATE tanks SET
                name             = COALESCE($2, name),
                capacity_liters  = COALESCE($3, capacity_liters),
                material         = COALESCE($4, material),
                status           = COALESCE($5, status),
                location         = COALESCE($6, location),
                notes            = COALESCE($7, notes),
                updated_at       = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(req.name)
            .bind(req.capacity_liters)
            .bind(req.material)
            .bind(req.status)
            .bind(req.location)
            .bind(req.notes)
            .fetch_one(&self.pool)
            .await?;

        Ok(tank)
    }

    pub async fn update_tank_status(&self, id: Uuid, status: TankStatus) -> Result<Tank, AppError> {
        let tank = sqlx::query_as::<_, Tank>(
            r#"
            UPDATE tanks SET status = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(status)
            .fetch_one(&self.pool)
            .await?;

        Ok(tank)
    }

    pub async fn delete_tank(&self, id: Uuid) -> Result<(), AppError> {
        // Proveri da li postoji aktivan batch
        let active: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM fermentation_batches WHERE tank_id = $1 AND status = 'active' LIMIT 1",
        )
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        if active.is_some() {
            return Err(AppError::Conflict(
                "Cannot delete tank with active fermentation batch".to_string(),
            ));
        }

        sqlx::query("DELETE FROM tanks WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // ============== Batch CRUD ==============

    pub async fn create_batch(
        &self,
        created_by: Uuid,
        req: CreateBatchRequest,
    ) -> Result<FermentationBatch, AppError> {
        // Proveri da li je tank dostupan
        let tank = self.find_tank_by_id(req.tank_id).await?;
        if tank.status != TankStatus::Available {
            return Err(AppError::Conflict(format!(
                "Tank '{}' is not available (status: {:?})",
                tank.name, tank.status
            )));
        }

        // Proveri da li volumen staje u tank
        if req.volume_liters > tank.capacity_liters {
            return Err(AppError::Conflict(format!(
                "Volume ({} L) exceeds tank capacity ({} L)",
                req.volume_liters, tank.capacity_liters
            )));
        }

        let batch = sqlx::query_as::<_, FermentationBatch>(
            r#"
            INSERT INTO fermentation_batches (
                tank_id, harvest_id, name, grape_variety, volume_liters,
                target_temperature, yeast_strain, initial_brix, initial_ph,
                expected_end_date, notes, created_by, start_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING *
            "#,
        )
            .bind(req.tank_id)
            .bind(req.harvest_id)
            .bind(&req.name)
            .bind(&req.grape_variety)
            .bind(req.volume_liters)
            .bind(req.target_temperature)
            .bind(&req.yeast_strain)
            .bind(req.initial_brix)
            .bind(req.initial_ph)
            .bind(req.expected_end_date)
            .bind(&req.notes)
            .bind(created_by)
            .fetch_one(&self.pool)
            .await?;

        // Postavi tank na in_use
        self.update_tank_status(req.tank_id, TankStatus::InUse).await?;

        Ok(batch)
    }

    pub async fn find_batch_by_id(&self, id: Uuid) -> Result<FermentationBatch, AppError> {
        sqlx::query_as::<_, FermentationBatch>(
            "SELECT * FROM fermentation_batches WHERE id = $1",
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Fermentation batch not found".to_string()),
                _ => AppError::DatabaseError(e),
            })
    }

    pub async fn list_batches(&self) -> Result<Vec<FermentationBatch>, AppError> {
        let batches = sqlx::query_as::<_, FermentationBatch>(
            "SELECT * FROM fermentation_batches ORDER BY created_at DESC",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(batches)
    }

    pub async fn list_active_batches(&self) -> Result<Vec<FermentationBatch>, AppError> {
        let batches = sqlx::query_as::<_, FermentationBatch>(
            "SELECT * FROM fermentation_batches WHERE status = 'active' ORDER BY start_date DESC",
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(batches)
    }

    pub async fn list_batches_by_tank(&self, tank_id: Uuid) -> Result<Vec<FermentationBatch>, AppError> {
        let batches = sqlx::query_as::<_, FermentationBatch>(
            "SELECT * FROM fermentation_batches WHERE tank_id = $1 ORDER BY created_at DESC",
        )
            .bind(tank_id)
            .fetch_all(&self.pool)
            .await?;

        Ok(batches)
    }

    pub async fn update_batch(
        &self,
        id: Uuid,
        req: UpdateBatchRequest,
    ) -> Result<FermentationBatch, AppError> {
        let batch = self.find_batch_by_id(id).await?;

        // Ako se završava batch, oslobodi tank
        if let Some(FermentationStatus::Completed) | Some(FermentationStatus::Cancelled) = &req.status {
            if batch.status == FermentationStatus::Active {
                self.update_tank_status(batch.tank_id, TankStatus::Available).await?;
            }
        }

        let updated = sqlx::query_as::<_, FermentationBatch>(
            r#"
            UPDATE fermentation_batches SET
                name              = COALESCE($2, name),
                volume_liters     = COALESCE($3, volume_liters),
                status            = COALESCE($4, status),
                target_temperature = COALESCE($5, target_temperature),
                yeast_strain      = COALESCE($6, yeast_strain),
                expected_end_date = COALESCE($7, expected_end_date),
                end_date          = COALESCE($8, end_date),
                notes             = COALESCE($9, notes),
                updated_at        = NOW()
            WHERE id = $1
            RETURNING *
            "#,
        )
            .bind(id)
            .bind(req.name)
            .bind(req.volume_liters)
            .bind(req.status)
            .bind(req.target_temperature)
            .bind(req.yeast_strain)
            .bind(req.expected_end_date)
            .bind(req.end_date)
            .bind(req.notes)
            .fetch_one(&self.pool)
            .await?;

        Ok(updated)
    }

    pub async fn delete_batch(&self, id: Uuid) -> Result<(), AppError> {
        let batch = self.find_batch_by_id(id).await?;

        // Ne možeš obrisati aktivan batch
        if batch.status == FermentationStatus::Active {
            return Err(AppError::Conflict(
                "Cannot delete an active fermentation batch. Cancel it first.".to_string(),
            ));
        }

        sqlx::query("DELETE FROM fermentation_batches WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // ============== Readings ==============

    pub async fn add_reading(
        &self,
        batch_id: Uuid,
        req: AddReadingRequest,
    ) -> Result<FermentationReading, AppError> {
        let recorded_at = req.recorded_at.unwrap_or_else(chrono::Utc::now);

        let reading = sqlx::query_as::<_, FermentationReading>(
            r#"
            INSERT INTO fermentation_readings (
                batch_id, temperature, brix, ph, density,
                alcohol_percent, volatile_acidity, free_so2, total_so2,
                color, clarity, aroma_notes, source, notes, recorded_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual', $13, $14)
            RETURNING *
            "#,
        )
            .bind(batch_id)
            .bind(req.temperature)
            .bind(req.brix)
            .bind(req.ph)
            .bind(req.density)
            .bind(req.alcohol_percent)
            .bind(req.volatile_acidity)
            .bind(req.free_so2)
            .bind(req.total_so2)
            .bind(req.color)
            .bind(req.clarity)
            .bind(req.aroma_notes)
            .bind(req.notes)
            .bind(recorded_at)
            .fetch_one(&self.pool)
            .await?;

        Ok(reading)
    }

    pub async fn add_iot_reading(
        &self,
        req: IotReadingRequest,
    ) -> Result<FermentationReading, AppError> {
        // Provjeri da batch postoji i aktivan je
        let batch = self.find_batch_by_id(req.batch_id).await?;
        if batch.status != FermentationStatus::Active {
            return Err(AppError::Conflict(
                "Can only add IoT readings to active batches".to_string(),
            ));
        }

        let recorded_at = req.recorded_at.unwrap_or_else(chrono::Utc::now);

        let reading = sqlx::query_as::<_, FermentationReading>(
            r#"
            INSERT INTO fermentation_readings (
                batch_id, temperature, source, recorded_at
            )
            VALUES ($1, $2, 'iot', $3)
            RETURNING *
            "#,
        )
            .bind(req.batch_id)
            .bind(req.temperature)
            .bind(recorded_at)
            .fetch_one(&self.pool)
            .await?;

        Ok(reading)
    }

    pub async fn list_readings(
        &self,
        batch_id: Uuid,
        limit: Option<i64>,
    ) -> Result<Vec<FermentationReading>, AppError> {
        let limit = limit.unwrap_or(100);

        let readings = sqlx::query_as::<_, FermentationReading>(
            r#"
            SELECT * FROM fermentation_readings
            WHERE batch_id = $1
            ORDER BY recorded_at DESC
            LIMIT $2
            "#,
        )
            .bind(batch_id)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;

        Ok(readings)
    }

    pub async fn get_latest_reading(
        &self,
        batch_id: Uuid,
    ) -> Result<Option<FermentationReading>, AppError> {
        let reading = sqlx::query_as::<_, FermentationReading>(
            r#"
            SELECT * FROM fermentation_readings
            WHERE batch_id = $1
            ORDER BY recorded_at DESC
            LIMIT 1
            "#,
        )
            .bind(batch_id)
            .fetch_optional(&self.pool)
            .await?;

        Ok(reading)
    }

    pub async fn delete_reading(&self, id: Uuid) -> Result<(), AppError> {
        sqlx::query("DELETE FROM fermentation_readings WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ============== Stats ==============

    pub async fn get_batch_stats(&self, batch_id: Uuid) -> Result<BatchStats, AppError> {
        let stats = sqlx::query_as::<_, BatchStats>(
            r#"
            SELECT
                $1::UUID                                    AS batch_id,
                COUNT(*)::BIGINT                            AS total_readings,
                AVG(temperature)                            AS avg_temperature,
                MIN(temperature)                            AS min_temperature,
                MAX(temperature)                            AS max_temperature,
                (SELECT brix FROM fermentation_readings
                 WHERE batch_id = $1 AND brix IS NOT NULL
                 ORDER BY recorded_at DESC LIMIT 1)         AS latest_brix,
                (SELECT ph FROM fermentation_readings
                 WHERE batch_id = $1 AND ph IS NOT NULL
                 ORDER BY recorded_at DESC LIMIT 1)         AS latest_ph,
                (SELECT alcohol_percent FROM fermentation_readings
                 WHERE batch_id = $1 AND alcohol_percent IS NOT NULL
                 ORDER BY recorded_at DESC LIMIT 1)         AS latest_alcohol,
                EXTRACT(EPOCH FROM (
                    COALESCE(MAX(recorded_at), NOW()) - MIN(recorded_at)
                )) / 86400.0                                AS duration_days
            FROM fermentation_readings
            WHERE batch_id = $1
            "#,
        )
            .bind(batch_id)
            .fetch_one(&self.pool)
            .await?;

        Ok(stats)
    }
}
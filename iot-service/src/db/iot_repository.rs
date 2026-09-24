use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    Device, DeviceStatus, ReadingStats, ReadingsQuery, SensorReading, SeriesPoint, TargetType,
    TelemetryMessage,
};

#[derive(Clone)]
pub struct IotRepository {
    pool: PgPool,
}

impl IotRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // ============== Devices ==============

    /// Upsert uređaja na osnovu status poruke (online/offline)
    pub async fn upsert_device_status(
        &self,
        device_id: &str,
        status: DeviceStatus,
        interval_seconds: Option<i32>,
        simulated: Option<bool>,
    ) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO devices (id, status, interval_seconds, simulated)
            VALUES ($1, $2, $3, COALESCE($4, FALSE))
            ON CONFLICT (id) DO UPDATE SET
                status           = EXCLUDED.status,
                interval_seconds = COALESCE(EXCLUDED.interval_seconds, devices.interval_seconds),
                simulated        = COALESCE($4, devices.simulated),
                last_seen_at     = CASE WHEN EXCLUDED.status = 'online' THEN NOW() ELSE devices.last_seen_at END,
                updated_at       = NOW()
            "#,
        )
            .bind(device_id)
            .bind(status)
            .bind(interval_seconds)
            .bind(simulated)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Telemetrija dokazuje da je uređaj online
    async fn touch_device(&self, device_id: &str) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO devices (id, status) VALUES ($1, 'online')
            ON CONFLICT (id) DO UPDATE SET
                status       = 'online',
                last_seen_at = NOW(),
                updated_at   = NOW()
            "#,
        )
            .bind(device_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn list_devices(&self) -> Result<Vec<Device>, AppError> {
        let devices = sqlx::query_as::<_, Device>("SELECT * FROM devices ORDER BY id")
            .fetch_all(&self.pool)
            .await?;

        Ok(devices)
    }

    pub async fn find_device(&self, device_id: &str) -> Result<Device, AppError> {
        sqlx::query_as::<_, Device>("SELECT * FROM devices WHERE id = $1")
            .bind(device_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| match e {
                sqlx::Error::RowNotFound => AppError::NotFound("Device not found".to_string()),
                _ => AppError::DatabaseError(e),
            })
    }

    // ============== Readings ==============

    pub async fn insert_reading(
        &self,
        device_id: &str,
        msg: &TelemetryMessage,
    ) -> Result<SensorReading, AppError> {
        self.touch_device(device_id).await?;

        let recorded_at = msg.recorded_at.unwrap_or_else(Utc::now);

        let reading = sqlx::query_as::<_, SensorReading>(
            r#"
            INSERT INTO sensor_readings (
                device_id, target_type, target_id, temperature, humidity, light_lux, recorded_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            "#,
        )
            .bind(device_id)
            .bind(msg.target_type)
            .bind(msg.target_id)
            .bind(msg.temperature)
            .bind(msg.humidity)
            .bind(msg.light_lux)
            .bind(recorded_at)
            .fetch_one(&self.pool)
            .await?;

        Ok(reading)
    }

    pub async fn list_readings(&self, q: &ReadingsQuery) -> Result<Vec<SensorReading>, AppError> {
        let limit = q.limit.unwrap_or(100).clamp(1, 1000);

        let readings = sqlx::query_as::<_, SensorReading>(
            r#"
            SELECT * FROM sensor_readings
            WHERE ($1::target_type IS NULL OR target_type = $1)
              AND ($2::uuid IS NULL OR target_id = $2)
              AND ($3::varchar IS NULL OR device_id = $3)
              AND ($4::timestamptz IS NULL OR recorded_at >= $4)
              AND ($5::timestamptz IS NULL OR recorded_at <= $5)
            ORDER BY recorded_at DESC
            LIMIT $6
            "#,
        )
            .bind(q.target_type)
            .bind(q.target_id)
            .bind(q.device_id.as_deref())
            .bind(q.from)
            .bind(q.to)
            .bind(limit)
            .fetch_all(&self.pool)
            .await?;

        Ok(readings)
    }

    /// Poslednje merenje za svaki tank / vinograd
    pub async fn latest_readings(
        &self,
        target_type: Option<TargetType>,
    ) -> Result<Vec<SensorReading>, AppError> {
        let readings = sqlx::query_as::<_, SensorReading>(
            r#"
            SELECT DISTINCT ON (target_type, target_id) *
            FROM sensor_readings
            WHERE ($1::target_type IS NULL OR target_type = $1)
            ORDER BY target_type, target_id, recorded_at DESC
            "#,
        )
            .bind(target_type)
            .fetch_all(&self.pool)
            .await?;

        Ok(readings)
    }

    /// Proseci po intervalima od `bucket_minutes` (podrazumevano poslednja 24h, 15 min)
    pub async fn series(
        &self,
        target_type: TargetType,
        target_id: Uuid,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        bucket_minutes: Option<i32>,
    ) -> Result<Vec<SeriesPoint>, AppError> {
        let to = to.unwrap_or_else(Utc::now);
        let from = from.unwrap_or_else(|| to - Duration::hours(24));
        let bucket_minutes = bucket_minutes.unwrap_or(15).clamp(1, 1440);

        let points = sqlx::query_as::<_, SeriesPoint>(
            r#"
            SELECT
                date_bin(make_interval(mins => $5), recorded_at, TIMESTAMPTZ '2000-01-01') AS bucket,
                AVG(temperature) AS temperature,
                AVG(humidity)    AS humidity,
                AVG(light_lux)   AS light_lux
            FROM sensor_readings
            WHERE target_type = $1 AND target_id = $2
              AND recorded_at BETWEEN $3 AND $4
            GROUP BY bucket
            ORDER BY bucket
            "#,
        )
            .bind(target_type)
            .bind(target_id)
            .bind(from)
            .bind(to)
            .bind(bucket_minutes)
            .fetch_all(&self.pool)
            .await?;

        Ok(points)
    }

    /// Statistika za jedan tank / vinograd (podrazumevano poslednja 24h)
    pub async fn stats(
        &self,
        target_type: TargetType,
        target_id: Uuid,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
    ) -> Result<ReadingStats, AppError> {
        let to = to.unwrap_or_else(Utc::now);
        let from = from.unwrap_or_else(|| to - Duration::hours(24));

        let stats = sqlx::query_as::<_, ReadingStats>(
            r#"
            SELECT
                COUNT(*)          AS total_readings,
                AVG(temperature)  AS avg_temperature,
                MIN(temperature)  AS min_temperature,
                MAX(temperature)  AS max_temperature,
                AVG(humidity)     AS avg_humidity,
                MIN(humidity)     AS min_humidity,
                MAX(humidity)     AS max_humidity,
                AVG(light_lux)    AS avg_light_lux,
                MAX(light_lux)    AS max_light_lux
            FROM sensor_readings
            WHERE target_type = $1 AND target_id = $2
              AND recorded_at BETWEEN $3 AND $4
            "#,
        )
            .bind(target_type)
            .bind(target_id)
            .bind(from)
            .bind(to)
            .fetch_one(&self.pool)
            .await?;

        Ok(stats)
    }
}

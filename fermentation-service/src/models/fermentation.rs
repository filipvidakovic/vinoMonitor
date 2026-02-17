use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ============== Enums ==============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "tank_status", rename_all = "lowercase")]
pub enum TankStatus {
    #[serde(rename = "available")]
    Available,
    #[serde(rename = "in_use")]
    InUse,
    #[serde(rename = "cleaning")]
    Cleaning,
    #[serde(rename = "maintenance")]
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "tank_material", rename_all = "lowercase")]
pub enum TankMaterial {
    #[serde(rename = "stainless_steel")]
    StainlessSteel,
    #[serde(rename = "oak")]
    Oak,
    #[serde(rename = "concrete")]
    Concrete,
    #[serde(rename = "fiberglass")]
    Fiberglass,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "fermentation_status", rename_all = "lowercase")]
pub enum FermentationStatus {
    #[serde(rename = "active")]
    Active,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "paused")]
    Paused,
    #[serde(rename = "cancelled")]
    Cancelled,
}

// ============== Tank (Fermentacioni Tank) ==============

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tank {
    pub id: Uuid,
    pub name: String,
    pub capacity_liters: f64,
    pub material: TankMaterial,
    pub status: TankStatus,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTankRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: String,

    #[validate(range(min = 1.0, message = "Capacity must be at least 1 liter"))]
    pub capacity_liters: f64,

    pub material: TankMaterial,

    pub location: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTankRequest {
    #[validate(length(min = 2))]
    pub name: Option<String>,

    #[validate(range(min = 1.0))]
    pub capacity_liters: Option<f64>,

    pub material: Option<TankMaterial>,
    pub status: Option<TankStatus>,
    pub location: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TankResponse {
    pub id: Uuid,
    pub name: String,
    pub capacity_liters: f64,
    pub material: TankMaterial,
    pub status: TankStatus,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub active_batch: Option<String>, // naziv aktivnog batch-a ako postoji
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Tank> for TankResponse {
    fn from(t: Tank) -> Self {
        TankResponse {
            id: t.id,
            name: t.name,
            capacity_liters: t.capacity_liters,
            material: t.material,
            status: t.status,
            location: t.location,
            notes: t.notes,
            active_batch: None,
            created_at: t.created_at,
            updated_at: t.updated_at,
        }
    }
}

// ============== Fermentation Batch ==============

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FermentationBatch {
    pub id: Uuid,
    pub tank_id: Uuid,
    pub harvest_id: Option<Uuid>, // reference na harvest service
    pub name: String,
    pub grape_variety: String,
    pub volume_liters: f64,
    pub status: FermentationStatus,
    // Parametri procesa
    pub target_temperature: Option<f64>,
    pub yeast_strain: Option<String>,
    pub initial_brix: Option<f64>,
    pub initial_ph: Option<f64>,
    // Datumi
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub expected_end_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateBatchRequest {
    pub tank_id: Uuid,
    pub harvest_id: Option<Uuid>,

    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: String,

    #[validate(length(min = 2, message = "Grape variety is required"))]
    pub grape_variety: String,

    #[validate(range(min = 1.0, message = "Volume must be at least 1 liter"))]
    pub volume_liters: f64,

    #[validate(range(min = 5.0, max = 35.0, message = "Target temperature must be 5-35°C"))]
    pub target_temperature: Option<f64>,

    pub yeast_strain: Option<String>,

    #[validate(range(min = 0.0, max = 50.0, message = "Brix must be 0-50"))]
    pub initial_brix: Option<f64>,

    #[validate(range(min = 0.0, max = 14.0, message = "pH must be 0-14"))]
    pub initial_ph: Option<f64>,

    pub expected_end_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateBatchRequest {
    #[validate(length(min = 2))]
    pub name: Option<String>,

    #[validate(range(min = 1.0))]
    pub volume_liters: Option<f64>,

    pub status: Option<FermentationStatus>,

    #[validate(range(min = 5.0, max = 35.0))]
    pub target_temperature: Option<f64>,

    pub yeast_strain: Option<String>,

    pub expected_end_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BatchResponse {
    pub id: Uuid,
    pub tank_id: Uuid,
    pub harvest_id: Option<Uuid>,
    pub name: String,
    pub grape_variety: String,
    pub volume_liters: f64,
    pub status: FermentationStatus,
    pub target_temperature: Option<f64>,
    pub yeast_strain: Option<String>,
    pub initial_brix: Option<f64>,
    pub initial_ph: Option<f64>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub expected_end_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub latest_reading: Option<ReadingResponse>, // poslednje merenje
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<FermentationBatch> for BatchResponse {
    fn from(b: FermentationBatch) -> Self {
        BatchResponse {
            id: b.id,
            tank_id: b.tank_id,
            harvest_id: b.harvest_id,
            name: b.name,
            grape_variety: b.grape_variety,
            volume_liters: b.volume_liters,
            status: b.status,
            target_temperature: b.target_temperature,
            yeast_strain: b.yeast_strain,
            initial_brix: b.initial_brix,
            initial_ph: b.initial_ph,
            start_date: b.start_date,
            end_date: b.end_date,
            expected_end_date: b.expected_end_date,
            notes: b.notes,
            created_by: b.created_by,
            latest_reading: None,
            created_at: b.created_at,
            updated_at: b.updated_at,
        }
    }
}

// ============== Fermentation Readings (merenja tokom procesa) ==============

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FermentationReading {
    pub id: Uuid,
    pub batch_id: Uuid,
    // Temperatura (može doći od IoT senzora ili ručno)
    pub temperature: Option<f64>,
    // Hemija
    pub brix: Option<f64>,
    pub ph: Option<f64>,
    pub density: Option<f64>, // g/mL specifična težina
    pub alcohol_percent: Option<f64>,
    pub volatile_acidity: Option<f64>,
    pub free_so2: Option<f64>,  // mg/L slobodnog SO2
    pub total_so2: Option<f64>, // mg/L ukupnog SO2
    // Vizuelno
    pub color: Option<String>,
    pub clarity: Option<String>,
    pub aroma_notes: Option<String>,
    // Meta
    pub source: String, // "manual" | "iot"
    pub notes: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AddReadingRequest {
    #[validate(range(min = -5.0, max = 45.0, message = "Temperature must be -5 to 45°C"))]
    pub temperature: Option<f64>,

    #[validate(range(min = 0.0, max = 50.0, message = "Brix must be 0-50"))]
    pub brix: Option<f64>,

    #[validate(range(min = 0.0, max = 14.0, message = "pH must be 0-14"))]
    pub ph: Option<f64>,

    #[validate(range(min = 0.8, max = 1.2, message = "Density must be 0.8-1.2 g/mL"))]
    pub density: Option<f64>,

    #[validate(range(min = 0.0, max = 22.0, message = "Alcohol must be 0-22%"))]
    pub alcohol_percent: Option<f64>,

    #[validate(range(min = 0.0, max = 3.0, message = "Volatile acidity out of range"))]
    pub volatile_acidity: Option<f64>,

    #[validate(range(min = 0.0, max = 100.0, message = "Free SO2 out of range"))]
    pub free_so2: Option<f64>,

    #[validate(range(min = 0.0, max = 350.0, message = "Total SO2 out of range"))]
    pub total_so2: Option<f64>,

    pub color: Option<String>,
    pub clarity: Option<String>,
    pub aroma_notes: Option<String>,
    pub notes: Option<String>,
    pub recorded_at: Option<DateTime<Utc>>,
}

// IoT reading iz senzora (jednostavniji format)
#[derive(Debug, Deserialize)]
pub struct IotReadingRequest {
    pub batch_id: Uuid,
    pub temperature: f64,
    pub humidity: Option<f64>, // ako senzor ima i vlažnost
    pub recorded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ReadingResponse {
    pub id: Uuid,
    pub batch_id: Uuid,
    pub temperature: Option<f64>,
    pub brix: Option<f64>,
    pub ph: Option<f64>,
    pub density: Option<f64>,
    pub alcohol_percent: Option<f64>,
    pub volatile_acidity: Option<f64>,
    pub free_so2: Option<f64>,
    pub total_so2: Option<f64>,
    pub color: Option<String>,
    pub clarity: Option<String>,
    pub aroma_notes: Option<String>,
    pub source: String,
    pub notes: Option<String>,
    pub recorded_at: DateTime<Utc>,
}

impl From<FermentationReading> for ReadingResponse {
    fn from(r: FermentationReading) -> Self {
        ReadingResponse {
            id: r.id,
            batch_id: r.batch_id,
            temperature: r.temperature,
            brix: r.brix,
            ph: r.ph,
            density: r.density,
            alcohol_percent: r.alcohol_percent,
            volatile_acidity: r.volatile_acidity,
            free_so2: r.free_so2,
            total_so2: r.total_so2,
            color: r.color,
            clarity: r.clarity,
            aroma_notes: r.aroma_notes,
            source: r.source,
            notes: r.notes,
            recorded_at: r.recorded_at,
        }
    }
}

// ============== Stats ==============

#[derive(Debug, Serialize, FromRow)]
pub struct BatchStats {
    pub batch_id: Uuid,
    pub total_readings: i64,
    pub avg_temperature: Option<f64>,
    pub min_temperature: Option<f64>,
    pub max_temperature: Option<f64>,
    pub latest_brix: Option<f64>,
    pub latest_ph: Option<f64>,
    pub latest_alcohol: Option<f64>,
    pub duration_days: Option<f64>,
}
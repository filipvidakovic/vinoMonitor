use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

/// Status berbe
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "harvest_status", rename_all = "lowercase")]
pub enum HarvestStatus {
    #[serde(rename = "planned")]
    Planned,
    #[serde(rename = "in_progress")]
    InProgress,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "cancelled")]
    Cancelled,
}

impl std::fmt::Display for HarvestStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HarvestStatus::Planned => write!(f, "planned"),
            HarvestStatus::InProgress => write!(f, "in_progress"),
            HarvestStatus::Completed => write!(f, "completed"),
            HarvestStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Berba - glavna tabela
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Harvest {
    pub id: Uuid,
    pub parcel_id: Uuid,
    pub vineyard_id: Uuid,
    pub harvest_date: NaiveDate,
    pub status: HarvestStatus,
    // Količina
    pub total_weight_kg: Option<f64>,
    pub yield_per_hectare: Option<f64>,
    // Vremenski uslovi
    pub weather_condition: Option<String>,
    pub temperature_celsius: Option<f64>,
    pub humidity_percent: Option<f64>,
    // Meta
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Kvalitet grožđa - merenja
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HarvestQuality {
    pub id: Uuid,
    pub harvest_id: Uuid,
    // Merenja šećera i kiseline
    pub brix: Option<f64>,    // % šećera (°Brix)
    pub ph: Option<f64>,       // pH vrednost
    pub acidity: Option<f64>,  // g/L ukupne kiseline
    // Vizuelna procena
    pub berry_size: Option<String>,   // small/medium/large
    pub berry_color: Option<String>,  // opis boje
    pub grape_health: Option<String>, // excellent/good/fair/poor
    // Napomene
    pub notes: Option<String>,
    pub measured_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

// ============== Request structs ==============

#[derive(Debug, Deserialize, Validate)]
pub struct CreateHarvestRequest {
    pub parcel_id: Uuid,
    pub vineyard_id: Uuid,

    pub harvest_date: NaiveDate,

    #[validate(range(min = 0.0, message = "Weight must be positive"))]
    pub total_weight_kg: Option<f64>,

    #[validate(range(min = 0.0, message = "Yield must be positive"))]
    pub yield_per_hectare: Option<f64>,

    #[validate(length(max = 255))]
    pub weather_condition: Option<String>,

    #[validate(range(min = -50.0, max = 60.0, message = "Temperature out of range"))]
    pub temperature_celsius: Option<f64>,

    #[validate(range(min = 0.0, max = 100.0, message = "Humidity must be 0-100%"))]
    pub humidity_percent: Option<f64>,

    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateHarvestRequest {
    pub harvest_date: Option<NaiveDate>,
    pub status: Option<HarvestStatus>,

    #[validate(range(min = 0.0, message = "Weight must be positive"))]
    pub total_weight_kg: Option<f64>,

    #[validate(range(min = 0.0, message = "Yield must be positive"))]
    pub yield_per_hectare: Option<f64>,

    #[validate(length(max = 255))]
    pub weather_condition: Option<String>,

    #[validate(range(min = -50.0, max = 60.0, message = "Temperature out of range"))]
    pub temperature_celsius: Option<f64>,

    #[validate(range(min = 0.0, max = 100.0, message = "Humidity must be 0-100%"))]
    pub humidity_percent: Option<f64>,

    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct AddQualityMeasurementRequest {
    #[validate(range(min = 0.0, max = 50.0, message = "Brix must be 0-50"))]
    pub brix: Option<f64>,

    #[validate(range(min = 0.0, max = 14.0, message = "pH must be 0-14"))]
    pub ph: Option<f64>,

    #[validate(range(min = 0.0, max = 30.0, message = "Acidity out of range"))]
    pub acidity: Option<f64>,

    pub berry_size: Option<String>,
    pub berry_color: Option<String>,
    pub grape_health: Option<String>,
    pub notes: Option<String>,
}

// ============== Response structs ==============

#[derive(Debug, Serialize)]
pub struct HarvestResponse {
    pub id: Uuid,
    pub parcel_id: Uuid,
    pub vineyard_id: Uuid,
    pub harvest_date: NaiveDate,
    pub status: HarvestStatus,
    pub total_weight_kg: Option<f64>,
    pub yield_per_hectare: Option<f64>,
    pub weather_condition: Option<String>,
    pub temperature_celsius: Option<f64>,
    pub humidity_percent: Option<f64>,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub quality_measurements: Vec<HarvestQualityResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct HarvestQualityResponse {
    pub id: Uuid,
    pub harvest_id: Uuid,
    pub brix: Option<f64>,
    pub ph: Option<f64>,
    pub acidity: Option<f64>,
    pub berry_size: Option<String>,
    pub berry_color: Option<String>,
    pub grape_health: Option<String>,
    pub notes: Option<String>,
    pub measured_at: DateTime<Utc>,
}

impl From<Harvest> for HarvestResponse {
    fn from(h: Harvest) -> Self {
        HarvestResponse {
            id: h.id,
            parcel_id: h.parcel_id,
            vineyard_id: h.vineyard_id,
            harvest_date: h.harvest_date,
            status: h.status,
            total_weight_kg: h.total_weight_kg,
            yield_per_hectare: h.yield_per_hectare,
            weather_condition: h.weather_condition,
            temperature_celsius: h.temperature_celsius,
            humidity_percent: h.humidity_percent,
            notes: h.notes,
            created_by: h.created_by,
            quality_measurements: vec![],
            created_at: h.created_at,
            updated_at: h.updated_at,
        }
    }
}

impl From<HarvestQuality> for HarvestQualityResponse {
    fn from(q: HarvestQuality) -> Self {
        HarvestQualityResponse {
            id: q.id,
            harvest_id: q.harvest_id,
            brix: q.brix,
            ph: q.ph,
            acidity: q.acidity,
            berry_size: q.berry_size,
            berry_color: q.berry_color,
            grape_health: q.grape_health,
            notes: q.notes,
            measured_at: q.measured_at,
        }
    }
}
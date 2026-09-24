use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::{Validate, ValidationError};

// ============== Enums ==============

/// Šta senzor meri: fermentacioni tank ili vinograd
#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq, Hash)]
#[sqlx(type_name = "target_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TargetType {
    Tank,
    Vineyard,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, PartialEq, Eq)]
#[sqlx(type_name = "device_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum DeviceStatus {
    Online,
    Offline,
}

// ============== Devices ==============

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Device {
    pub id: String,
    pub status: DeviceStatus,
    pub interval_seconds: Option<i32>,
    pub simulated: bool,
    pub last_seen_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============== Sensor readings ==============

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SensorReading {
    pub id: Uuid,
    pub device_id: String,
    pub target_type: TargetType,
    pub target_id: Uuid,
    pub temperature: Option<f64>, // °C
    pub humidity: Option<f64>,    // % (tankovi)
    pub light_lux: Option<f64>,   // lux (vinogradi - sunčeva svetlost)
    pub recorded_at: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ReadingStats {
    pub total_readings: i64,
    pub avg_temperature: Option<f64>,
    pub min_temperature: Option<f64>,
    pub max_temperature: Option<f64>,
    pub avg_humidity: Option<f64>,
    pub min_humidity: Option<f64>,
    pub max_humidity: Option<f64>,
    pub avg_light_lux: Option<f64>,
    pub max_light_lux: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ReadingsQuery {
    pub target_type: Option<TargetType>,
    pub target_id: Option<Uuid>,
    pub device_id: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

/// Proseci po vremenskim intervalima (za grafikone)
#[derive(Debug, Serialize, FromRow)]
pub struct SeriesPoint {
    pub bucket: DateTime<Utc>,
    pub temperature: Option<f64>,
    pub humidity: Option<f64>,
    pub light_lux: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct SeriesQuery {
    pub target_type: TargetType,
    pub target_id: Uuid,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub bucket_minutes: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct LatestQuery {
    pub target_type: Option<TargetType>,
}

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub target_type: TargetType,
    pub target_id: Uuid,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

// ============== MQTT poruke ==============

/// Payload na `{prefix}/devices/{device_id}/telemetry`
#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_has_value"))]
pub struct TelemetryMessage {
    pub target_type: TargetType,
    pub target_id: Uuid,

    #[validate(range(min = -40.0, max = 85.0, message = "Temperature out of sensor range"))]
    pub temperature: Option<f64>,

    #[validate(range(min = 0.0, max = 100.0, message = "Humidity must be 0-100%"))]
    pub humidity: Option<f64>,

    #[validate(range(min = 0.0, max = 200000.0, message = "Light must be 0-200000 lux"))]
    pub light_lux: Option<f64>,

    pub recorded_at: Option<DateTime<Utc>>,

    /// Simulirana merenja se čuvaju, ali se ne prosleđuju u fermentacione batch-eve
    #[serde(default)]
    pub simulated: bool,
}

fn validate_has_value(msg: &TelemetryMessage) -> Result<(), ValidationError> {
    if msg.temperature.is_none() && msg.humidity.is_none() && msg.light_lux.is_none() {
        return Err(ValidationError::new("empty_telemetry"));
    }
    Ok(())
}

/// Payload na `{prefix}/devices/{device_id}/status` (retained, uključujući LWT "offline")
#[derive(Debug, Deserialize)]
pub struct StatusMessage {
    pub status: DeviceStatus,
    pub interval_seconds: Option<i32>,
    pub simulated: Option<bool>,
}

/// Komanda koju server šalje uređaju na `{prefix}/devices/{device_id}/commands`
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum DeviceCommand {
    /// Promeni period merenja
    SetInterval { interval_seconds: u32 },
    /// Izmeri i pošalji odmah
    ReadNow,
    /// Uređaj ponovo objavljuje status
    Ping,
}

impl DeviceCommand {
    pub fn validate(&self) -> Result<(), String> {
        match self {
            DeviceCommand::SetInterval { interval_seconds } if !(5..=3600).contains(interval_seconds) => {
                Err("interval_seconds must be between 5 and 3600".to_string())
            }
            _ => Ok(()),
        }
    }
}

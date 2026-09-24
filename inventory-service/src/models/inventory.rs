use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

/// Zapremina jedne flaše (L)
pub const BOTTLE_VOLUME_LITERS: f64 = 0.7;

// ============== Poreklo vina (snimak iz drugih servisa) ==============
//
// Snimak se pravi u trenutku flaširanja i kopira u SVAKU flašu, tako da flaša
// nosi kompletnu istoriju čak i ako se vinograd / berba / batch kasnije izmene
// ili obrišu. Polja se deserijalizuju direktno iz JSON odgovora drugih servisa.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VineyardInfo {
    pub id: String,
    pub name: String,
    pub location: String,
    pub total_area: f64,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParcelInfo {
    pub id: String,
    pub name: String,
    pub area: f64,
    pub grape_variety: String,
    #[serde(default)]
    pub planting_year: Option<i32>,
    #[serde(default)]
    pub soil_type: Option<String>,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityInfo {
    #[serde(default)]
    pub brix: Option<f64>,
    #[serde(default)]
    pub ph: Option<f64>,
    #[serde(default)]
    pub acidity: Option<f64>,
    #[serde(default)]
    pub berry_size: Option<String>,
    #[serde(default)]
    pub berry_color: Option<String>,
    #[serde(default)]
    pub grape_health: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    pub measured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HarvestInfo {
    pub id: String,
    pub harvest_date: String,
    pub status: String,
    #[serde(default)]
    pub total_weight_kg: Option<f64>,
    #[serde(default)]
    pub yield_per_hectare: Option<f64>,
    #[serde(default)]
    pub weather_condition: Option<String>,
    #[serde(default)]
    pub temperature_celsius: Option<f64>,
    #[serde(default)]
    pub humidity_percent: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub quality_measurements: Vec<QualityInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FermentationStatsInfo {
    #[serde(default)]
    pub total_readings: i64,
    #[serde(default)]
    pub avg_temperature: Option<f64>,
    #[serde(default)]
    pub min_temperature: Option<f64>,
    #[serde(default)]
    pub max_temperature: Option<f64>,
    #[serde(default)]
    pub latest_brix: Option<f64>,
    #[serde(default)]
    pub latest_ph: Option<f64>,
    #[serde(default)]
    pub latest_alcohol: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FermentationInfo {
    pub batch_id: String,
    pub batch_name: String,
    pub grape_variety: String,
    /// Zapremina šire na početku fermentacije
    pub volume_liters: f64,
    pub yeast_strain: Option<String>,
    pub target_temperature: Option<f64>,
    pub initial_brix: Option<f64>,
    pub initial_ph: Option<f64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
    pub tank_name: Option<String>,
    pub tank_material: Option<String>,
    pub stats: FermentationStatsInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub vineyard: Option<VineyardInfo>,
    pub parcel: Option<ParcelInfo>,
    pub harvest: Option<HarvestInfo>,
    pub fermentation: FermentationInfo,
}

// ============== Flaširanje (lot) ==============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bottling {
    #[serde(rename = "_id")]
    pub id: String,
    pub lot_code: String,
    pub batch_id: String,
    pub wine_name: String,
    pub grape_variety: String,
    pub vintage: Option<i32>,
    /// Litara vina dobijenih posle fermentacije
    pub wine_liters: f64,
    pub bottle_volume_liters: f64,
    pub bottle_count: i64,
    /// Litara koji ne čine punu flašu
    pub remainder_liters: f64,
    pub notes: Option<String>,
    pub bottled_by: String,
    pub bottled_at: DateTime<Utc>,
    pub provenance: Provenance,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateBottlingRequest {
    pub batch_id: String,

    #[validate(range(min = 0.7, max = 1000000.0, message = "Wine liters must be at least 0.7 L"))]
    pub wine_liters: f64,

    #[validate(length(min = 2, max = 120, message = "Wine name must be 2-120 characters"))]
    pub wine_name: Option<String>,

    pub notes: Option<String>,
}

/// Broj flaša po statusu (za lot i ukupno)
#[derive(Debug, Clone, Serialize, Default)]
pub struct StatusCounts {
    pub in_stock: i64,
    pub sold: i64,
    pub damaged: i64,
}

#[derive(Debug, Serialize)]
pub struct BottlingResponse {
    #[serde(flatten)]
    pub bottling: Bottling,
    pub counts: StatusCounts,
}

#[derive(Debug, Deserialize)]
pub struct BottlingsQuery {
    pub batch_id: Option<String>,
}

// ============== Flaše ==============

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BottleStatus {
    InStock,
    Sold,
    Damaged,
}

impl BottleStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BottleStatus::InStock => "in_stock",
            BottleStatus::Sold => "sold",
            BottleStatus::Damaged => "damaged",
        }
    }
}

/// Jedna flaša - nosi kompletno poreklo (vinograd, berba, fermentacija)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bottle {
    #[serde(rename = "_id")]
    pub id: String,
    /// Jedinstveni serijski broj, npr. "L26-3F9A2C-00042"
    pub serial: String,
    pub number: i64,
    pub bottling_id: String,
    pub lot_code: String,
    pub wine_name: String,
    pub grape_variety: String,
    pub vintage: Option<i32>,
    pub volume_liters: f64,
    pub status: BottleStatus,
    pub bottled_at: DateTime<Utc>,
    pub status_changed_at: DateTime<Utc>,
    pub provenance: Provenance,
}

/// Flaša bez porekla - za liste (manji odgovor)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BottleSummary {
    #[serde(rename = "_id")]
    pub id: String,
    pub serial: String,
    pub number: i64,
    pub bottling_id: String,
    pub lot_code: String,
    pub wine_name: String,
    pub vintage: Option<i32>,
    pub volume_liters: f64,
    pub status: BottleStatus,
    pub status_changed_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct BottlesQuery {
    pub bottling_id: Option<String>,
    pub status: Option<BottleStatus>,
    /// Pretraga po serijskom broju
    pub search: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct BottlesPage {
    pub items: Vec<BottleSummary>,
    pub total: u64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBottleStatusRequest {
    pub status: BottleStatus,
}

/// Ukupno stanje skladišta
#[derive(Debug, Serialize)]
pub struct InventoryStats {
    pub lots: u64,
    pub counts: StatusCounts,
    pub liters_in_stock: f64,
}

// ============== DTO-i odgovora drugih servisa ==============

#[derive(Debug, Deserialize)]
pub struct BatchDto {
    pub id: String,
    pub tank_id: String,
    #[serde(default)]
    pub harvest_id: Option<String>,
    pub name: String,
    pub grape_variety: String,
    pub volume_liters: f64,
    pub status: String,
    #[serde(default)]
    pub target_temperature: Option<f64>,
    #[serde(default)]
    pub yeast_strain: Option<String>,
    #[serde(default)]
    pub initial_brix: Option<f64>,
    #[serde(default)]
    pub initial_ph: Option<f64>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TankDto {
    pub name: String,
    pub material: String,
}

#[derive(Debug, Deserialize)]
pub struct HarvestDto {
    #[serde(flatten)]
    pub info: HarvestInfo,
    pub vineyard_id: String,
    pub parcel_id: String,
}

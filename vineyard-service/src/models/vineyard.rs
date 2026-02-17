use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Vineyard {
    pub id: Uuid,
    pub name: String,
    pub location: String,
    pub total_area: f64, // hectares
    pub owner_id: Uuid,  // reference to user from auth service
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Parcel {
    pub id: Uuid,
    pub vineyard_id: Uuid,
    pub name: String,
    pub area: f64, // square meters
    pub grape_variety: String,
    pub planting_year: Option<i32>,
    pub soil_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateVineyardRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: String,

    #[validate(length(min = 2, message = "Location must be at least 2 characters"))]
    pub location: String,

    #[validate(range(min = 0.01, message = "Total area must be greater than 0"))]
    pub total_area: f64,

    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateVineyardRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: Option<String>,

    #[validate(length(min = 2, message = "Location must be at least 2 characters"))]
    pub location: Option<String>,

    #[validate(range(min = 0.01, message = "Total area must be greater than 0"))]
    pub total_area: Option<f64>,

    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateParcelRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: String,

    #[validate(range(min = 1.0, message = "Area must be at least 1 square meter"))]
    pub area: f64,

    #[validate(length(min = 2, message = "Grape variety must be at least 2 characters"))]
    pub grape_variety: String,

    pub planting_year: Option<i32>,
    pub soil_type: Option<String>,

    #[validate(range(min = -90.0, max = 90.0, message = "Invalid latitude"))]
    pub latitude: Option<f64>,

    #[validate(range(min = -180.0, max = 180.0, message = "Invalid longitude"))]
    pub longitude: Option<f64>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateParcelRequest {
    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub name: Option<String>,

    #[validate(range(min = 1.0, message = "Area must be at least 1 square meter"))]
    pub area: Option<f64>,

    #[validate(length(min = 2, message = "Grape variety must be at least 2 characters"))]
    pub grape_variety: Option<String>,

    pub planting_year: Option<i32>,
    pub soil_type: Option<String>,

    #[validate(range(min = -90.0, max = 90.0, message = "Invalid latitude"))]
    pub latitude: Option<f64>,

    #[validate(range(min = -180.0, max = 180.0, message = "Invalid longitude"))]
    pub longitude: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct VineyardResponse {
    pub id: Uuid,
    pub name: String,
    pub location: String,
    pub total_area: f64,
    pub owner_id: Uuid,
    pub description: Option<String>,
    pub parcel_count: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Vineyard> for VineyardResponse {
    fn from(vineyard: Vineyard) -> Self {
        VineyardResponse {
            id: vineyard.id,
            name: vineyard.name,
            location: vineyard.location,
            total_area: vineyard.total_area,
            owner_id: vineyard.owner_id,
            description: vineyard.description,
            parcel_count: None,
            created_at: vineyard.created_at,
            updated_at: vineyard.updated_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ParcelResponse {
    pub id: Uuid,
    pub vineyard_id: Uuid,
    pub name: String,
    pub area: f64,
    pub grape_variety: String,
    pub planting_year: Option<i32>,
    pub soil_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Parcel> for ParcelResponse {
    fn from(parcel: Parcel) -> Self {
        ParcelResponse {
            id: parcel.id,
            vineyard_id: parcel.vineyard_id,
            name: parcel.name,
            area: parcel.area,
            grape_variety: parcel.grape_variety,
            planting_year: parcel.planting_year,
            soil_type: parcel.soil_type,
            latitude: parcel.latitude,
            longitude: parcel.longitude,
            created_at: parcel.created_at,
            updated_at: parcel.updated_at,
        }
    }
}
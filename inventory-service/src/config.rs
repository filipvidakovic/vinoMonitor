use std::env;

#[derive(Clone, Debug)]
pub struct Settings {
    pub mongodb_uri: String,
    pub mongodb_db: String,
    pub host: String,
    pub port: u16,
    pub jwt_secret: String,
    pub allowed_origins: Vec<String>,
    // Servisi iz kojih se skuplja poreklo vina
    pub vineyard_service_url: String,
    pub harvest_service_url: String,
    pub fermentation_service_url: String,
}

impl Settings {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Settings {
            mongodb_uri: env::var("MONGODB_URI")?,
            mongodb_db: env::var("MONGODB_DB").unwrap_or_else(|_| "vinomonitor_inventory".to_string()),
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8006".to_string())
                .parse()?,
            jwt_secret: env::var("JWT_SECRET")?,
            allowed_origins,
            vineyard_service_url: env::var("VINEYARD_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8002".to_string()),
            harvest_service_url: env::var("HARVEST_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8003".to_string()),
            fermentation_service_url: env::var("FERMENTATION_SERVICE_URL")
                .unwrap_or_else(|_| "http://localhost:8004".to_string()),
        })
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

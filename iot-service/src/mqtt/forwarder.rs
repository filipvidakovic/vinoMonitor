use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use chrono::{DateTime, Utc};
use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

/// Prosleđuje temperaturu tanka fermentation-service-u, koji je upisuje kao
/// IoT merenje aktivnog batch-a. Throttle po tanku da ne bi zatrpali tabelu
/// fermentation_readings (senzor meri na ~minut, a u batch ide npr. na 10 min).
#[derive(Clone)]
pub struct FermentationForwarder {
    http: reqwest::Client,
    base_url: String,
    interval: Duration,
    last_sent: Arc<Mutex<HashMap<Uuid, Instant>>>,
}

impl FermentationForwarder {
    pub fn new(base_url: String, interval_secs: u64) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .expect("Failed to build HTTP client"),
            base_url: base_url.trim_end_matches('/').to_string(),
            interval: Duration::from_secs(interval_secs),
            last_sent: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Vraća true i beleži vreme ako je za ovaj tank prošao interval
    fn try_acquire(&self, tank_id: Uuid) -> bool {
        let mut last_sent = self.last_sent.lock().unwrap();
        let now = Instant::now();
        match last_sent.get(&tank_id) {
            Some(t) if now.duration_since(*t) < self.interval => false,
            _ => {
                last_sent.insert(tank_id, now);
                true
            }
        }
    }

    pub async fn forward(
        &self,
        tank_id: Uuid,
        temperature: f64,
        humidity: Option<f64>,
        recorded_at: DateTime<Utc>,
    ) {
        if !self.try_acquire(tank_id) {
            return;
        }

        let url = format!("{}/api/v1/iot/tanks/{}/readings", self.base_url, tank_id);
        let body = json!({
            "temperature": temperature,
            "humidity": humidity,
            "recorded_at": recorded_at,
        });

        match self.http.post(&url).json(&body).send().await {
            Ok(res) if res.status().is_success() => {
                tracing::debug!("Forwarded tank {} temperature to fermentation-service", tank_id);
            }
            Ok(res) if res.status() == StatusCode::NOT_FOUND => {
                tracing::debug!("Tank {} has no active batch, reading not forwarded", tank_id);
            }
            Ok(res) => {
                tracing::warn!("fermentation-service rejected reading for tank {}: {}", tank_id, res.status());
            }
            Err(e) => {
                tracing::warn!("Failed to reach fermentation-service: {}", e);
            }
        }
    }
}

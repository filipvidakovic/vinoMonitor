use std::time::Duration;

use reqwest::StatusCode;
use serde::de::DeserializeOwned;

use crate::{
    config::Settings,
    error::AppError,
    models::{
        BatchDto, FermentationInfo, FermentationStatsInfo, HarvestDto, ParcelInfo, Provenance,
        TankDto, VineyardInfo,
    },
};

/// HTTP klijent ka vineyard / harvest / fermentation servisima.
/// Svi pozivi idu sa tokenom korisnika koji flašira.
#[derive(Clone)]
pub struct ServiceClients {
    http: reqwest::Client,
    vineyard_url: String,
    harvest_url: String,
    fermentation_url: String,
}

impl ServiceClients {
    pub fn new(settings: &Settings) -> Self {
        let trim = |s: &str| s.trim_end_matches('/').to_string();
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("Failed to build HTTP client"),
            vineyard_url: trim(&settings.vineyard_service_url),
            harvest_url: trim(&settings.harvest_service_url),
            fermentation_url: trim(&settings.fermentation_service_url),
        }
    }

    async fn get_json<T: DeserializeOwned>(&self, url: &str, token: &str, what: &str) -> Result<T, AppError> {
        let res = self
            .http
            .get(url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::UpstreamError(format!("Cannot reach service for {}: {}", what, e)))?;

        match res.status() {
            s if s.is_success() => res
                .json::<T>()
                .await
                .map_err(|e| AppError::UpstreamError(format!("Invalid {} response: {}", what, e))),
            StatusCode::NOT_FOUND => Err(AppError::NotFound(format!("{} not found", what))),
            StatusCode::FORBIDDEN => Err(AppError::Forbidden(format!("No access to {}", what))),
            StatusCode::UNAUTHORIZED => Err(AppError::Unauthorized("Invalid or expired token".to_string())),
            s => Err(AppError::UpstreamError(format!("{} request failed ({})", what, s))),
        }
    }

    pub async fn get_batch(&self, batch_id: &str, token: &str) -> Result<BatchDto, AppError> {
        let url = format!("{}/api/v1/batches/{}", self.fermentation_url, batch_id);
        self.get_json(&url, token, "Fermentation batch").await
    }

    /// Skuplja kompletno poreklo vina za batch
    pub async fn collect_provenance(&self, batch: &BatchDto, token: &str) -> Result<Provenance, AppError> {
        let f = &self.fermentation_url;

        // Tank i statistika nisu kritični - ako padnu, flaša ostaje bez tih detalja
        let tank: Option<TankDto> = self
            .get_json(&format!("{}/api/v1/tanks/{}", f, batch.tank_id), token, "Tank")
            .await
            .ok();
        let stats: FermentationStatsInfo = self
            .get_json(&format!("{}/api/v1/batches/{}/stats", f, batch.id), token, "Batch stats")
            .await
            .unwrap_or_default();

        // Berba -> vinograd -> parcela (batch ne mora imati berbu)
        let (harvest, vineyard, parcel) = match &batch.harvest_id {
            Some(harvest_id) => {
                let h: HarvestDto = self
                    .get_json(&format!("{}/api/v1/harvests/{}", self.harvest_url, harvest_id), token, "Harvest")
                    .await?;
                let vineyard: VineyardInfo = self
                    .get_json(
                        &format!("{}/api/v1/vineyards/{}", self.vineyard_url, h.vineyard_id),
                        token,
                        "Vineyard",
                    )
                    .await?;
                let parcel: Option<ParcelInfo> = self
                    .get_json(
                        &format!(
                            "{}/api/v1/vineyards/{}/parcels/{}",
                            self.vineyard_url, h.vineyard_id, h.parcel_id
                        ),
                        token,
                        "Parcel",
                    )
                    .await
                    .ok();
                (Some(h.info), Some(vineyard), parcel)
            }
            None => (None, None, None),
        };

        Ok(Provenance {
            vineyard,
            parcel,
            harvest,
            fermentation: FermentationInfo {
                batch_id: batch.id.clone(),
                batch_name: batch.name.clone(),
                grape_variety: batch.grape_variety.clone(),
                volume_liters: batch.volume_liters,
                yeast_strain: batch.yeast_strain.clone(),
                target_temperature: batch.target_temperature,
                initial_brix: batch.initial_brix,
                initial_ph: batch.initial_ph,
                start_date: batch.start_date.clone(),
                end_date: batch.end_date.clone(),
                notes: batch.notes.clone(),
                tank_name: tank.as_ref().map(|t| t.name.clone()),
                tank_material: tank.map(|t| t.material),
                stats,
            },
        })
    }
}

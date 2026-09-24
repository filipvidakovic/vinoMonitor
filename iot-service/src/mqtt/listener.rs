use std::time::Duration;

use rumqttc::{AsyncClient, Event, EventLoop, LastWill, MqttOptions, Packet, Publish, QoS};
use validator::Validate;

use crate::{
    config::Settings,
    db::IotRepository,
    error::AppError,
    models::{DeviceCommand, StatusMessage, TargetType, TelemetryMessage},
};

use super::FermentationForwarder;

/// Topic struktura:
///   {prefix}/devices/{device_id}/telemetry  uređaj -> server  (merenja)
///   {prefix}/devices/{device_id}/status     uređaj -> server  (online/offline, retained + LWT)
///   {prefix}/devices/{device_id}/commands   server -> uređaj  (set_interval, read_now, ping)
///   {prefix}/server/status                  status samog iot-service-a (retained + LWT)
#[derive(Clone)]
pub struct MqttHandle {
    client: AsyncClient,
    prefix: String,
}

impl MqttHandle {
    pub async fn send_command(&self, device_id: &str, command: &DeviceCommand) -> Result<(), AppError> {
        let topic = format!("{}/devices/{}/commands", self.prefix, device_id);
        let payload = serde_json::to_vec(command)
            .map_err(|e| AppError::InternalError(e.to_string()))?;

        self.client
            .publish(topic, QoS::AtLeastOnce, false, payload)
            .await
            .map_err(|e| AppError::MqttError(e.to_string()))
    }
}

pub fn start(
    settings: &Settings,
    repo: IotRepository,
    forwarder: Option<FermentationForwarder>,
) -> MqttHandle {
    let prefix = settings.mqtt_topic_prefix.clone();
    let server_status_topic = format!("{}/server/status", prefix);

    let mut options = MqttOptions::new(
        settings.mqtt_client_id.clone(),
        settings.mqtt_host.clone(),
        settings.mqtt_port,
    );
    options.set_keep_alive(Duration::from_secs(30));
    options.set_last_will(LastWill::new(
        &server_status_topic,
        r#"{"status":"offline"}"#,
        QoS::AtLeastOnce,
        true,
    ));
    if let (Some(user), Some(pass)) = (&settings.mqtt_username, &settings.mqtt_password) {
        options.set_credentials(user, pass);
    }

    let (client, event_loop) = AsyncClient::new(options, 100);

    tokio::spawn(run_event_loop(
        client.clone(),
        event_loop,
        prefix.clone(),
        repo,
        forwarder,
    ));

    MqttHandle { client, prefix }
}

async fn run_event_loop(
    client: AsyncClient,
    mut event_loop: EventLoop,
    prefix: String,
    repo: IotRepository,
    forwarder: Option<FermentationForwarder>,
) {
    loop {
        match event_loop.poll().await {
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                tracing::info!("Connected to MQTT broker");
                // Pretplata na svaki (re)connect - clean session ne pamti pretplate.
                // try_* jer ne smemo blokirati event loop koji prazni red zahteva.
                for suffix in ["telemetry", "status"] {
                    let topic = format!("{}/devices/+/{}", prefix, suffix);
                    if let Err(e) = client.try_subscribe(&topic, QoS::AtLeastOnce) {
                        tracing::error!("Failed to subscribe to {}: {}", topic, e);
                    }
                }
                let _ = client.try_publish(
                    format!("{}/server/status", prefix),
                    QoS::AtLeastOnce,
                    true,
                    r#"{"status":"online"}"#,
                );
            }
            Ok(Event::Incoming(Packet::Publish(publish))) => {
                handle_publish(&prefix, &repo, forwarder.as_ref(), publish).await;
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("MQTT connection error: {}. Reconnecting in 5s...", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

/// "{prefix}/devices/{device_id}/{kind}" -> (device_id, kind)
fn parse_topic<'a>(prefix: &str, topic: &'a str) -> Option<(&'a str, &'a str)> {
    let rest = topic.strip_prefix(prefix)?.strip_prefix("/devices/")?;
    let (device_id, kind) = rest.split_once('/')?;
    let valid_id = !device_id.is_empty()
        && device_id.len() <= 64
        && device_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    valid_id.then_some((device_id, kind))
}

async fn handle_publish(
    prefix: &str,
    repo: &IotRepository,
    forwarder: Option<&FermentationForwarder>,
    publish: Publish,
) {
    let Some((device_id, kind)) = parse_topic(prefix, &publish.topic) else {
        tracing::warn!("Ignoring message on unexpected topic {}", publish.topic);
        return;
    };

    match kind {
        "telemetry" => {
            let msg: TelemetryMessage = match serde_json::from_slice(&publish.payload) {
                Ok(m) => m,
                Err(e) => {
                    tracing::warn!("Invalid telemetry from {}: {}", device_id, e);
                    return;
                }
            };
            if let Err(e) = msg.validate() {
                tracing::warn!("Rejected telemetry from {}: {}", device_id, e);
                return;
            }

            let reading = match repo.insert_reading(device_id, &msg).await {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to store telemetry from {}: {}", device_id, e);
                    return;
                }
            };
            tracing::debug!(
                "Stored reading from {} for {:?} {}",
                device_id, reading.target_type, reading.target_id
            );

            if let (Some(fw), TargetType::Tank, Some(temp), false) =
                (forwarder, reading.target_type, reading.temperature, msg.simulated)
            {
                // HTTP poziv van event loop-a da ne kočimo prijem poruka
                let fw = fw.clone();
                tokio::spawn(async move {
                    fw.forward(reading.target_id, temp, reading.humidity, reading.recorded_at)
                        .await;
                });
            }
        }
        "status" => {
            // Prazan retained payload = brisanje retained poruke, ignorišemo
            if publish.payload.is_empty() {
                return;
            }
            match serde_json::from_slice::<StatusMessage>(&publish.payload) {
                Ok(msg) => {
                    tracing::info!("Device {} is {:?}", device_id, msg.status);
                    if let Err(e) = repo
                        .upsert_device_status(device_id, msg.status, msg.interval_seconds, msg.simulated)
                        .await
                    {
                        tracing::error!("Failed to update status of {}: {}", device_id, e);
                    }
                }
                Err(e) => tracing::warn!("Invalid status from {}: {}", device_id, e),
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::parse_topic;

    #[test]
    fn parses_device_topics() {
        assert_eq!(
            parse_topic("vinomonitor", "vinomonitor/devices/rpi-cellar-01/telemetry"),
            Some(("rpi-cellar-01", "telemetry"))
        );
        assert_eq!(parse_topic("vinomonitor", "other/devices/x/telemetry"), None);
        assert_eq!(parse_topic("vinomonitor", "vinomonitor/devices//telemetry"), None);
        assert_eq!(parse_topic("vinomonitor", "vinomonitor/devices/bad id/status"), None);
    }
}

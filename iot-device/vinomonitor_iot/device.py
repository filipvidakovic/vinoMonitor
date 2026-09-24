"""MQTT klijent uređaja: periodično šalje merenja i prima komande od iot-service-a.

Topici ({p} = topic_prefix, {id} = device_id):
    {p}/devices/{id}/telemetry  -> jedna poruka po target-u (tank / vinograd)
    {p}/devices/{id}/status     -> {"status": "online"|"offline", ...} retained + LWT
    {p}/devices/{id}/commands   <- {"command": "set_interval"|"read_now"|"ping", ...}
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import paho.mqtt.client as mqtt

from .config import MAX_INTERVAL, MIN_INTERVAL, Settings, TargetConfig
from .sensors import Sensor, SensorError, create_sensor

log = logging.getLogger(__name__)


class TargetReader:
    """Svi senzori jednog tanka / vinograda, spojeni u jednu poruku."""

    def __init__(self, target: TargetConfig, simulate: bool):
        self.target = target
        self.simulate = simulate
        self.sensors: List[Sensor] = [
            create_sensor(s, target.target_type, simulate) for s in target.sensors
        ]

    def read(self) -> Optional[Dict[str, Any]]:
        values: Dict[str, float] = {}
        for sensor in self.sensors:
            try:
                values.update(sensor.read())
            except (SensorError, OSError) as e:
                log.warning("[%s] %s", self.target.name, e)
        if not values:
            return None
        payload = {
            "target_type": self.target.target_type,
            "target_id": self.target.target_id,
            **values,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        if self.simulate:
            # Server čuva, ali ne upisuje lažna merenja u fermentacione batch-eve
            payload["simulated"] = True
        return payload

    def close(self) -> None:
        for sensor in self.sensors:
            sensor.close()


class Device:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.interval = settings.interval_seconds
        self.readers = [TargetReader(t, settings.simulate) for t in settings.targets]

        base = "{}/devices/{}".format(settings.mqtt.topic_prefix, settings.device_id)
        self.telemetry_topic = base + "/telemetry"
        self.status_topic = base + "/status"
        self.commands_topic = base + "/commands"

        self._wake = threading.Event()   # budi glavnu petlju (read_now, set_interval)
        self._stop = threading.Event()

        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=settings.device_id,
        )
        if settings.mqtt.username:
            self.client.username_pw_set(settings.mqtt.username, settings.mqtt.password)
        # Ako uređaj nestane (struja, mreža), broker objavljuje "offline"
        self.client.will_set(self.status_topic, json.dumps({"status": "offline"}), qos=1, retain=True)
        self.client.reconnect_delay_set(min_delay=1, max_delay=60)
        # Dok nema konekcije, QoS1 poruke čekaju u memoriji
        self.client.max_queued_messages_set(1000)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

    # ---------- MQTT callbacks (paho thread) ----------

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            log.error("MQTT connect failed: %s", reason_code)
            return
        log.info("Connected to MQTT broker %s:%s", self.settings.mqtt.host, self.settings.mqtt.port)
        client.subscribe(self.commands_topic, qos=1)
        self._publish_status()

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        if not self._stop.is_set():
            log.warning("Disconnected from MQTT broker (%s), reconnecting...", reason_code)

    def _on_message(self, client, userdata, msg):
        try:
            cmd = json.loads(msg.payload)
            name = cmd["command"]
        except (ValueError, KeyError, TypeError):
            log.warning("Invalid command payload: %r", msg.payload)
            return

        log.info("Command received: %s", cmd)
        if name == "set_interval":
            try:
                interval = int(cmd["interval_seconds"])
            except (KeyError, TypeError, ValueError):
                log.warning("set_interval without valid interval_seconds")
                return
            if not MIN_INTERVAL <= interval <= MAX_INTERVAL:
                log.warning("Interval %s out of range", interval)
                return
            self.interval = interval
            self._publish_status()
            self._wake.set()
        elif name == "read_now":
            self._wake.set()
        elif name == "ping":
            self._publish_status()
        else:
            log.warning("Unknown command: %s", name)

    # ---------- publishing ----------

    def _publish_status(self, status: str = "online") -> mqtt.MQTTMessageInfo:
        payload = {
            "status": status,
            "interval_seconds": self.interval,
            "targets": [
                {"target_type": r.target.target_type, "target_id": r.target.target_id, "name": r.target.name}
                for r in self.readers
            ],
            "simulated": self.settings.simulate,
        }
        return self.client.publish(self.status_topic, json.dumps(payload), qos=1, retain=True)

    def read_all(self) -> List[Tuple[TargetReader, Dict[str, Any]]]:
        results = []
        for reader in self.readers:
            payload = reader.read()
            if payload is not None:
                results.append((reader, payload))
        return results

    def _publish_readings(self) -> None:
        for reader, payload in self.read_all():
            info = self.client.publish(self.telemetry_topic, json.dumps(payload), qos=1)
            if info.rc == mqtt.MQTT_ERR_SUCCESS:
                log.info("[%s] %s", reader.target.name, _format_values(payload))
            else:
                log.warning("[%s] queued, broker not connected (rc=%s)", reader.target.name, info.rc)

    # ---------- lifecycle ----------

    def run(self) -> None:
        mqtt_cfg = self.settings.mqtt
        self.client.connect_async(mqtt_cfg.host, mqtt_cfg.port, keepalive=mqtt_cfg.keepalive)
        self.client.loop_start()
        log.info(
            "Device '%s' started: %d target(s), every %ss%s",
            self.settings.device_id, len(self.readers), self.interval,
            " (SIMULATION)" if self.settings.simulate else "",
        )
        try:
            while not self._stop.is_set():
                self._publish_readings()
                self._wake.wait(timeout=self.interval)
                self._wake.clear()
        finally:
            self._shutdown()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def _shutdown(self) -> None:
        log.info("Shutting down")
        # Uredno gašenje: LWT se ne šalje, pa sami objavimo offline
        if self.client.is_connected():
            self._publish_status("offline").wait_for_publish(timeout=3)
        self.client.disconnect()
        self.client.loop_stop()
        for reader in self.readers:
            reader.close()


def _format_values(payload: Dict[str, Any]) -> str:
    units = {"temperature": "°C", "humidity": "%", "light_lux": " lux"}
    return ", ".join("{}={}{}".format(k, payload[k], u) for k, u in units.items() if k in payload)

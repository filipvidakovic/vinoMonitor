"""Učitavanje i validacija settings.json fajla."""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

TARGET_TYPES = ("tank", "vineyard")
SENSOR_TYPES = ("dht22", "dht11", "ds18b20", "bh1750")
MIN_INTERVAL = 5
MAX_INTERVAL = 3600

_DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class ConfigError(ValueError):
    pass


@dataclass
class MqttConfig:
    host: str
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None
    topic_prefix: str = "vinomonitor"
    keepalive: int = 30


@dataclass
class SensorConfig:
    type: str
    # dht11/dht22: GPIO pin kao ime iz `board` modula, npr. "D4"
    # bh1750: I2C adresa, npr. "0x23"
    # ds18b20: 1-wire ID, npr. "28-3c01d607d4a1" ili "auto"
    options: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TargetConfig:
    target_type: str
    target_id: str
    name: str
    sensors: List[SensorConfig]


@dataclass
class Settings:
    device_id: str
    mqtt: MqttConfig
    interval_seconds: int
    simulate: bool
    targets: List[TargetConfig]


def _require(data: Dict[str, Any], key: str, where: str) -> Any:
    if key not in data:
        raise ConfigError("Missing '{}' in {}".format(key, where))
    return data[key]


def load_settings(path: str) -> Settings:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise ConfigError("Settings file not found: {} (copy settings.example.json)".format(path))
    except json.JSONDecodeError as e:
        raise ConfigError("Invalid JSON in {}: {}".format(path, e))

    device_id = _require(data, "device_id", "settings")
    if not _DEVICE_ID_RE.match(device_id):
        raise ConfigError("device_id may contain only letters, digits, '-' and '_' (max 64)")

    mqtt_data = _require(data, "mqtt", "settings")
    mqtt = MqttConfig(
        host=_require(mqtt_data, "host", "mqtt"),
        port=int(mqtt_data.get("port", 1883)),
        username=mqtt_data.get("username") or None,
        password=mqtt_data.get("password") or None,
        topic_prefix=mqtt_data.get("topic_prefix", "vinomonitor"),
        keepalive=int(mqtt_data.get("keepalive", 30)),
    )

    interval = int(data.get("interval_seconds", 60))
    if not MIN_INTERVAL <= interval <= MAX_INTERVAL:
        raise ConfigError("interval_seconds must be between {} and {}".format(MIN_INTERVAL, MAX_INTERVAL))

    targets = []
    for i, t in enumerate(_require(data, "targets", "settings")):
        where = "targets[{}]".format(i)
        target_type = _require(t, "target_type", where)
        if target_type not in TARGET_TYPES:
            raise ConfigError("{}.target_type must be one of {}".format(where, TARGET_TYPES))

        target_id = _require(t, "target_id", where)
        try:
            uuid.UUID(target_id)
        except ValueError:
            raise ConfigError("{}.target_id must be a UUID (tank id / vineyard id)".format(where))

        sensors = []
        for j, s in enumerate(_require(t, "sensors", where)):
            s = dict(s)
            sensor_type = s.pop("type", None)
            if sensor_type not in SENSOR_TYPES:
                raise ConfigError("{}.sensors[{}].type must be one of {}".format(where, j, SENSOR_TYPES))
            sensors.append(SensorConfig(type=sensor_type, options=s))
        if not sensors:
            raise ConfigError("{} has no sensors".format(where))

        targets.append(TargetConfig(
            target_type=target_type,
            target_id=target_id,
            name=t.get("name", target_id),
            sensors=sensors,
        ))

    if not targets:
        raise ConfigError("At least one target is required")

    return Settings(
        device_id=device_id,
        mqtt=mqtt,
        interval_seconds=interval,
        simulate=bool(data.get("simulate", False)),
        targets=targets,
    )

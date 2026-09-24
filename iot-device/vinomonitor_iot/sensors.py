"""Drajveri senzora.

Hardverske biblioteke (board, adafruit_*) se importuju tek kad se senzor kreira,
tako da simulacija radi i na računaru bez Raspberry Pi-ja.

Vrednosti koje senzor vraća (ključevi odgovaraju MQTT payload-u):
    temperature  °C
    humidity     %
    light_lux    lux
"""

from __future__ import annotations

import glob
import logging
import math
import os
import random
import time
from datetime import datetime
from typing import Dict

from .config import SensorConfig

log = logging.getLogger(__name__)

Reading = Dict[str, float]


class SensorError(RuntimeError):
    pass


class Sensor:
    name = "sensor"

    def read(self) -> Reading:
        raise NotImplementedError

    def close(self) -> None:
        pass


class DHTSensor(Sensor):
    """DHT11 / DHT22 (AM2302) - temperatura i vlažnost. Pogodan za tankove."""

    def __init__(self, model: str, pin: str):
        import adafruit_dht  # type: ignore
        import board  # type: ignore

        self.name = "{}@{}".format(model, pin)
        cls = adafruit_dht.DHT22 if model == "dht22" else adafruit_dht.DHT11
        self._dev = cls(getattr(board, pin), use_pulseio=False)

    def read(self) -> Reading:
        # DHT je poznat po povremenim greškama checksum-a, pa probamo nekoliko puta
        last_error = None
        for _ in range(4):
            try:
                t = self._dev.temperature
                h = self._dev.humidity
                if t is not None and h is not None:
                    return {"temperature": round(t, 2), "humidity": round(h, 2)}
            except RuntimeError as e:
                last_error = e
            time.sleep(2.0)
        raise SensorError("{}: no valid reading ({})".format(self.name, last_error))

    def close(self) -> None:
        self._dev.exit()


class DS18B20Sensor(Sensor):
    """DS18B20 vodootporna sonda - temperatura. Preko 1-Wire (dtoverlay=w1-gpio)."""

    BASE = "/sys/bus/w1/devices"

    def __init__(self, sensor_id: str = "auto"):
        if sensor_id == "auto":
            found = sorted(glob.glob(os.path.join(self.BASE, "28-*")))
            if not found:
                raise SensorError("No DS18B20 found on 1-Wire bus (is w1-gpio enabled?)")
            path = found[0]
        else:
            path = os.path.join(self.BASE, sensor_id)
        self._file = os.path.join(path, "w1_slave")
        self.name = "ds18b20@{}".format(os.path.basename(path))

    def read(self) -> Reading:
        for _ in range(3):
            with open(self._file) as f:
                lines = f.read().splitlines()
            # Prva linija se završava sa YES ako je CRC ispravan, druga sadrži t=12345 (m°C)
            if len(lines) >= 2 and lines[0].strip().endswith("YES") and "t=" in lines[1]:
                milli = int(lines[1].split("t=")[1])
                if milli != 85000:  # 85°C = vrednost pri uključenju, nije pravo merenje
                    return {"temperature": round(milli / 1000.0, 2)}
            time.sleep(0.5)
        raise SensorError("{}: CRC check failed".format(self.name))


class BH1750Sensor(Sensor):
    """BH1750 - intenzitet svetlosti (lux) preko I2C. Za sunčevu svetlost u vinogradu."""

    def __init__(self, address: str = "0x23"):
        import adafruit_bh1750  # type: ignore
        import board  # type: ignore

        self.name = "bh1750@{}".format(address)
        self._dev = adafruit_bh1750.BH1750(board.I2C(), address=int(address, 16))

    def read(self) -> Reading:
        lux = self._dev.lux
        if lux is None:
            raise SensorError("{}: no reading".format(self.name))
        return {"light_lux": round(lux, 1)}


class SimulatedSensor(Sensor):
    """Realistične lažne vrednosti za razvoj bez hardvera."""

    def __init__(self, sensor_type: str, target_type: str):
        self.name = "sim-{}".format(sensor_type)
        self._type = sensor_type
        self._target = target_type
        # Tank ima svoju "baznu" temperaturu koja polako luta (fermentacija greje)
        self._tank_temp = random.uniform(16.0, 22.0)

    def _daylight(self, hour: float) -> float:
        """0 noću, do 1 u podne (izlazak ~6h, zalazak ~20h)."""
        return max(0.0, math.sin(math.pi * (hour - 6.0) / 14.0))

    def read(self) -> Reading:
        now = datetime.now()
        hour = now.hour + now.minute / 60.0

        if self._target == "tank":
            self._tank_temp += random.uniform(-0.15, 0.2)
            self._tank_temp = min(max(self._tank_temp, 12.0), 30.0)
            temperature = self._tank_temp
        else:
            temperature = 12.0 + 12.0 * self._daylight(hour) + random.gauss(0, 0.4)

        if self._type == "bh1750":
            clouds = random.uniform(0.6, 1.0)
            return {"light_lux": round(90000 * self._daylight(hour) * clouds, 1)}
        if self._type == "ds18b20":
            return {"temperature": round(temperature, 2)}
        humidity = random.gauss(72.0, 3.0) if self._target == "tank" else random.gauss(60.0, 8.0)
        return {
            "temperature": round(temperature, 2),
            "humidity": round(min(max(humidity, 0.0), 100.0), 2),
        }


def create_sensor(cfg: SensorConfig, target_type: str, simulate: bool) -> Sensor:
    if simulate:
        return SimulatedSensor(cfg.type, target_type)
    if cfg.type in ("dht22", "dht11"):
        return DHTSensor(cfg.type, cfg.options.get("pin", "D4"))
    if cfg.type == "ds18b20":
        return DS18B20Sensor(cfg.options.get("sensor_id", "auto"))
    if cfg.type == "bh1750":
        return BH1750Sensor(cfg.options.get("address", "0x23"))
    raise ValueError("Unknown sensor type: {}".format(cfg.type))

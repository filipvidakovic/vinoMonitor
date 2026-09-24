# vinoMonitor IoT uređaj (Raspberry Pi, Python)

Čita senzore i šalje merenja preko MQTT-a (Mosquitto) ka `iot-service`-u (Rust).

| Lokacija          | Merenja                        | Senzori                                  |
|-------------------|--------------------------------|------------------------------------------|
| Fermentacioni tank| temperatura, vlažnost          | DHT22 / DHT11 (ili DS18B20 sonda za temp)|
| Vinograd          | sunčeva svetlost, temperatura  | BH1750 (lux) + DS18B20 ili DHT22         |

## Arhitektura

```
 Raspberry Pi (Python)              Mosquitto               iot-service (Rust)          fermentation-service
 ─────────────────────   MQTT    ─────────────   MQTT    ──────────────────────  HTTP  ────────────────────
 senzori → telemetry  ─────────► vinomonitor/  ────────► čuva u Postgres        ─────► IoT reading aktivnog
           status (LWT)─────────►  devices/#   ────────► status uređaja                batch-a u tanku
           commands   ◄───────── ◄──────────── ◄──────── POST /devices/:id/commands
```

### MQTT topici (`{p}` = `topic_prefix`, podrazumevano `vinomonitor`)

| Topic                              | Smer            | QoS | Payload |
|------------------------------------|-----------------|-----|---------|
| `{p}/devices/{id}/telemetry`       | uređaj → server | 1   | `{"target_type":"tank","target_id":"<uuid>","temperature":18.4,"humidity":72.1,"recorded_at":"..."}` |
| `{p}/devices/{id}/status`          | uređaj → server | 1, retained, LWT | `{"status":"online","interval_seconds":60,...}` / `{"status":"offline"}` |
| `{p}/devices/{id}/commands`        | server → uređaj | 1   | `{"command":"set_interval","interval_seconds":30}`, `{"command":"read_now"}`, `{"command":"ping"}` |

Za vinograd payload sadrži `light_lux` (i `temperature`) umesto `humidity`.
`target_id` je ID tanka iz fermentation-service-a, odnosno ID vinograda iz vineyard-service-a.

## Povezivanje (Raspberry Pi GPIO)

| Senzor  | VCC          | GND | Signal                                   | Napomena |
|---------|--------------|-----|------------------------------------------|----------|
| DHT22   | 3.3V (pin 1) | pin 6 | DATA → GPIO4 (pin 7) = `"pin": "D4"`   | 10kΩ pull-up na DATA (moduli ga obično imaju) |
| BH1750  | 3.3V (pin 1) | pin 9 | SDA → GPIO2 (pin 3), SCL → GPIO3 (pin 5) | ADDR na GND → `0x23`, na VCC → `0x5C` |
| DS18B20 | 3.3V (pin 17)| pin 14| DQ → GPIO22 (pin 15)                    | 4.7kΩ pull-up između DQ i 3.3V |

Više DHT senzora = različiti GPIO pinovi (`D4`, `D17`, `D27`...). Više DS18B20 sondi može
na istu 1-Wire liniju; svaka ima svoj ID (`ls /sys/bus/w1/devices/`).

> Za temperaturu samog vina preporučuje se vodootporna DS18B20 sonda u termo-džepu tanka;
> DHT22 meri vazduh (temperatura/vlažnost podruma oko tanka).

## Instalacija na Raspberry Pi-ju

```bash
# 1. Uključi I2C (BH1750) i 1-Wire (DS18B20)
sudo raspi-config nonint do_i2c 0
echo "dtoverlay=w1-gpio,gpiopin=22" | sudo tee -a /boot/firmware/config.txt
sudo apt install -y python3-venv libgpiod2
sudo reboot

# 2. Kod i zavisnosti
cd ~/vinomonitor/iot-device
python3 -m venv .venv
.venv/bin/pip install -r requirements-rpi.txt

# 3. Konfiguracija
cp settings.example.json settings.json
nano settings.json   # device_id, IP računara sa Mosquitto-om, target_id-evi, pinovi

# 4. Provera senzora bez MQTT-a
.venv/bin/python -m vinomonitor_iot --dry-run

# 5. Pokretanje kao servis (automatski start, restart posle greške)
sudo cp vinomonitor-iot.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now vinomonitor-iot
journalctl -u vinomonitor-iot -f
```

## Razvoj bez hardvera (simulacija)

Radi i na Windows-u / Linux-u, bez Raspberry Pi-ja. Potreban je samo `paho-mqtt`:

```bash
pip install -r requirements.txt
docker compose up -d mosquitto          # iz root foldera projekta
python -m vinomonitor_iot --config settings.json --simulate
```

Simulirane vrednosti: tank ~16–22 °C sa sporim promenama, vlažnost ~72 %, vinograd prati
dnevni ciklus (svetlost 0 lux noću, do ~90 000 lux u podne).

## settings.json

| Polje               | Opis |
|---------------------|------|
| `device_id`         | Jedinstveno ime uređaja (slova, cifre, `-`, `_`), koristi se u MQTT topicu |
| `mqtt.host/port`    | Adresa Mosquitto brokera (IP računara na kome radi docker-compose) |
| `mqtt.username/password` | Opciono, ako je u Mosquitto-u uključena autentifikacija |
| `interval_seconds`  | Period merenja (5–3600 s); može se menjati komandom `set_interval` |
| `simulate`          | `true` = lažni senzori |
| `targets[]`         | Tank ili vinograd: `target_type` (`tank`/`vineyard`), `target_id` (UUID), `sensors[]` |
| `sensors[]`         | `{"type":"dht22","pin":"D4"}`, `{"type":"dht11","pin":"D4"}`, `{"type":"bh1750","address":"0x23"}`, `{"type":"ds18b20","sensor_id":"auto"}` |

Ako broker nije dostupan, QoS 1 poruke se čuvaju u memoriji (do 1000) i šalju po ponovnom povezivanju.
Ako uređaj izgubi struju ili mrežu, broker objavljuje `offline` status (Last Will).

-- Enums
CREATE TYPE target_type AS ENUM ('tank', 'vineyard');
CREATE TYPE device_status AS ENUM ('online', 'offline');

-- IoT uređaji (Raspberry Pi) - registruju se automatski pri prvoj MQTT poruci
CREATE TABLE devices (
                         id                VARCHAR(64) PRIMARY KEY,   -- device_id iz MQTT topica
                         status            device_status NOT NULL DEFAULT 'online',
                         interval_seconds  INTEGER,
                         simulated         BOOLEAN NOT NULL DEFAULT FALSE,   -- lažni senzori (razvoj / demo)
                         last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Merenja senzora (tank: temperatura + vlažnost, vinograd: sunčeva svetlost + temperatura)
CREATE TABLE sensor_readings (
                                 id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 device_id    VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                                 target_type  target_type NOT NULL,
                                 target_id    UUID NOT NULL,   -- tank_id (fermentation-service) ili vineyard_id (vineyard-service), bez FK
                                 temperature  DOUBLE PRECISION CHECK (temperature BETWEEN -40 AND 85),
                                 humidity     DOUBLE PRECISION CHECK (humidity BETWEEN 0 AND 100),
                                 light_lux    DOUBLE PRECISION CHECK (light_lux BETWEEN 0 AND 200000),
                                 recorded_at  TIMESTAMPTZ NOT NULL,
                                 received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 CHECK (temperature IS NOT NULL OR humidity IS NOT NULL OR light_lux IS NOT NULL)
);

-- Indeksi
CREATE INDEX idx_readings_target      ON sensor_readings(target_type, target_id, recorded_at DESC);
CREATE INDEX idx_readings_device_id   ON sensor_readings(device_id, recorded_at DESC);
CREATE INDEX idx_readings_recorded_at ON sensor_readings(recorded_at DESC);

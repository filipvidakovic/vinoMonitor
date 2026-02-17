-- Enums
CREATE TYPE tank_status AS ENUM ('available', 'in_use', 'cleaning', 'maintenance');
CREATE TYPE tank_material AS ENUM ('stainless_steel', 'oak', 'concrete', 'fiberglass');
CREATE TYPE fermentation_status AS ENUM ('active', 'completed', 'paused', 'cancelled');

-- Tanks (fermentacioni tankovi)
CREATE TABLE tanks (
                       id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       name             VARCHAR(255) NOT NULL UNIQUE,
                       capacity_liters  DOUBLE PRECISION NOT NULL CHECK (capacity_liters > 0),
                       material         tank_material NOT NULL,
                       status           tank_status NOT NULL DEFAULT 'available',
                       location         VARCHAR(255),
                       notes            TEXT,
                       created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                       updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fermentation batches
CREATE TABLE fermentation_batches (
                                      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                      tank_id             UUID NOT NULL REFERENCES tanks(id),
                                      harvest_id          UUID,        -- referenca na harvest-service (bez FK - drugi servis)
                                      name                VARCHAR(255) NOT NULL,
                                      grape_variety       VARCHAR(255) NOT NULL,
                                      volume_liters       DOUBLE PRECISION NOT NULL CHECK (volume_liters > 0),
                                      status              fermentation_status NOT NULL DEFAULT 'active',
    -- Parametri procesa
                                      target_temperature  DOUBLE PRECISION CHECK (target_temperature BETWEEN 5 AND 35),
                                      yeast_strain        VARCHAR(255),
                                      initial_brix        DOUBLE PRECISION CHECK (initial_brix BETWEEN 0 AND 50),
                                      initial_ph          DOUBLE PRECISION CHECK (initial_ph BETWEEN 0 AND 14),
    -- Datumi
                                      start_date          TIMESTAMPTZ DEFAULT NOW(),
                                      end_date            TIMESTAMPTZ,
                                      expected_end_date   TIMESTAMPTZ,
                                      notes               TEXT,
                                      created_by          UUID NOT NULL,
                                      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fermentation readings (merenja tokom procesa, ručna + IoT)
CREATE TABLE fermentation_readings (
                                       id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                       batch_id          UUID NOT NULL REFERENCES fermentation_batches(id) ON DELETE CASCADE,
    -- Temperatura
                                       temperature       DOUBLE PRECISION CHECK (temperature BETWEEN -5 AND 45),
    -- Hemija
                                       brix              DOUBLE PRECISION CHECK (brix BETWEEN 0 AND 50),
                                       ph                DOUBLE PRECISION CHECK (ph BETWEEN 0 AND 14),
                                       density           DOUBLE PRECISION CHECK (density BETWEEN 0.8 AND 1.2),
                                       alcohol_percent   DOUBLE PRECISION CHECK (alcohol_percent BETWEEN 0 AND 22),
                                       volatile_acidity  DOUBLE PRECISION CHECK (volatile_acidity BETWEEN 0 AND 3),
                                       free_so2          DOUBLE PRECISION CHECK (free_so2 BETWEEN 0 AND 100),
                                       total_so2         DOUBLE PRECISION CHECK (total_so2 BETWEEN 0 AND 350),
    -- Vizuelno
                                       color             VARCHAR(255),
                                       clarity           VARCHAR(255),
                                       aroma_notes       TEXT,
    -- Meta
                                       source            VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual' | 'iot'
                                       notes             TEXT,
                                       recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                       created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeksi
CREATE INDEX idx_tanks_status           ON tanks(status);
CREATE INDEX idx_batches_tank_id        ON fermentation_batches(tank_id);
CREATE INDEX idx_batches_status         ON fermentation_batches(status);
CREATE INDEX idx_batches_created_by     ON fermentation_batches(created_by);
CREATE INDEX idx_batches_harvest_id     ON fermentation_batches(harvest_id);
CREATE INDEX idx_readings_batch_id      ON fermentation_readings(batch_id);
CREATE INDEX idx_readings_recorded_at   ON fermentation_readings(recorded_at DESC);
CREATE INDEX idx_readings_source        ON fermentation_readings(source);
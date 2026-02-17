-- Harvest status enum
CREATE TYPE harvest_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');

-- Harvests tabela
CREATE TABLE harvests (
                          id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          parcel_id           UUID NOT NULL,
                          vineyard_id         UUID NOT NULL,
                          harvest_date        DATE NOT NULL,
                          status              harvest_status NOT NULL DEFAULT 'planned',
    -- Količina
                          total_weight_kg     DOUBLE PRECISION CHECK (total_weight_kg >= 0),
                          yield_per_hectare   DOUBLE PRECISION CHECK (yield_per_hectare >= 0),
    -- Vremenski uslovi
                          weather_condition   VARCHAR(255),
                          temperature_celsius DOUBLE PRECISION CHECK (temperature_celsius BETWEEN -50 AND 60),
                          humidity_percent    DOUBLE PRECISION CHECK (humidity_percent BETWEEN 0 AND 100),
    -- Meta
                          notes               TEXT,
                          created_by          UUID NOT NULL,
                          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Harvest quality merenja
CREATE TABLE harvest_quality (
                                 id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                 harvest_id   UUID NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
    -- Hemijska merenja
                                 brix         DOUBLE PRECISION CHECK (brix BETWEEN 0 AND 50),
                                 ph           DOUBLE PRECISION CHECK (ph BETWEEN 0 AND 14),
                                 acidity      DOUBLE PRECISION CHECK (acidity BETWEEN 0 AND 30),
    -- Vizuelna procena
                                 berry_size   VARCHAR(50),
                                 berry_color  VARCHAR(255),
                                 grape_health VARCHAR(50),
    -- Meta
                                 notes        TEXT,
                                 measured_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                 created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeksi
CREATE INDEX idx_harvests_parcel_id   ON harvests(parcel_id);
CREATE INDEX idx_harvests_vineyard_id ON harvests(vineyard_id);
CREATE INDEX idx_harvests_date        ON harvests(harvest_date DESC);
CREATE INDEX idx_harvests_status      ON harvests(status);
CREATE INDEX idx_harvests_created_by  ON harvests(created_by);

CREATE INDEX idx_harvest_quality_harvest_id ON harvest_quality(harvest_id);
CREATE INDEX idx_harvest_quality_measured_at ON harvest_quality(measured_at);
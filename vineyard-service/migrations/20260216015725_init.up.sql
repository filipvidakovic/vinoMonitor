-- Create vineyards table
CREATE TABLE vineyards (
                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                           owner_id UUID NOT NULL,
                           name VARCHAR(255) NOT NULL,
                           location VARCHAR(255) NOT NULL,
                           total_area DOUBLE PRECISION NOT NULL CHECK (total_area > 0),
                           description TEXT,
                           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create parcels table
CREATE TABLE parcels (
                         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                         vineyard_id UUID NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
                         name VARCHAR(255) NOT NULL,
                         area DOUBLE PRECISION NOT NULL CHECK (area > 0),
                         grape_variety VARCHAR(255) NOT NULL,
                         planting_year INTEGER,
                         soil_type VARCHAR(255),
                         latitude DOUBLE PRECISION CHECK (latitude >= -90 AND latitude <= 90),
                         longitude DOUBLE PRECISION CHECK (longitude >= -180 AND longitude <= 180),
                         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_vineyards_owner_id ON vineyards(owner_id);
CREATE INDEX idx_vineyards_created_at ON vineyards(created_at DESC);

CREATE INDEX idx_parcels_vineyard_id ON parcels(vineyard_id);
CREATE INDEX idx_parcels_grape_variety ON parcels(grape_variety);
CREATE INDEX idx_parcels_created_at ON parcels(created_at DESC);

-- Create index for geo queries (if needed later for PostGIS)
CREATE INDEX idx_parcels_location ON parcels(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
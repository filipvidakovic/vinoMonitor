-- Drop indexes
DROP INDEX IF EXISTS idx_parcels_location;
DROP INDEX IF EXISTS idx_parcels_created_at;
DROP INDEX IF EXISTS idx_parcels_grape_variety;
DROP INDEX IF EXISTS idx_parcels_vineyard_id;
DROP INDEX IF EXISTS idx_vineyards_created_at;
DROP INDEX IF EXISTS idx_vineyards_owner_id;

-- Drop tables
DROP TABLE IF EXISTS parcels;
DROP TABLE IF EXISTS vineyards;
DROP INDEX IF EXISTS idx_readings_source;
DROP INDEX IF EXISTS idx_readings_recorded_at;
DROP INDEX IF EXISTS idx_readings_batch_id;
DROP INDEX IF EXISTS idx_batches_harvest_id;
DROP INDEX IF EXISTS idx_batches_created_by;
DROP INDEX IF EXISTS idx_batches_status;
DROP INDEX IF EXISTS idx_batches_tank_id;
DROP INDEX IF EXISTS idx_tanks_status;

DROP TABLE IF EXISTS fermentation_readings;
DROP TABLE IF EXISTS fermentation_batches;
DROP TABLE IF EXISTS tanks;

DROP TYPE IF EXISTS fermentation_status;
DROP TYPE IF EXISTS tank_material;
DROP TYPE IF EXISTS tank_status;
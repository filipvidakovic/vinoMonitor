DROP INDEX IF EXISTS idx_harvest_quality_measured_at;
DROP INDEX IF EXISTS idx_harvest_quality_harvest_id;
DROP INDEX IF EXISTS idx_harvests_created_by;
DROP INDEX IF EXISTS idx_harvests_status;
DROP INDEX IF EXISTS idx_harvests_date;
DROP INDEX IF EXISTS idx_harvests_vineyard_id;
DROP INDEX IF EXISTS idx_harvests_parcel_id;

DROP TABLE IF EXISTS harvest_quality;
DROP TABLE IF EXISTS harvests;

DROP TYPE IF EXISTS harvest_status;
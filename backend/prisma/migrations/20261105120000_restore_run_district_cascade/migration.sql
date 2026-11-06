-- Makes the district link of a run optional AND restores cascade-on-delete for district runs.
-- Self-contained and idempotent: it is correct whether or not the previous migration
-- (20261105010000_allow_standalone_grid_cell_runs) has already been applied.
--
-- 1. A standalone grid-cell run has no district, so districtId must accept NULL (no-op if already nullable).
-- 2. Deleting a district removes the runs and daily rows that belong to it (the original behaviour). The
--    previous migration used ON DELETE SET NULL, which would turn a deleted district's runs into orphan
--    "standalone" runs. Standalone runs have districtId = NULL, so cascading never touches them.
-- No rows are changed.

ALTER TABLE "DatasetRun" ALTER COLUMN "districtId" DROP NOT NULL;
ALTER TABLE "ClimateDaily" ALTER COLUMN "districtId" DROP NOT NULL;

ALTER TABLE "DatasetRun" DROP CONSTRAINT IF EXISTS "DatasetRun_districtId_fkey";
ALTER TABLE "DatasetRun" ADD CONSTRAINT "DatasetRun_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClimateDaily" DROP CONSTRAINT IF EXISTS "ClimateDaily_districtId_fkey";
ALTER TABLE "ClimateDaily" ADD CONSTRAINT "ClimateDaily_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

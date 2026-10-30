-- Add a flexible payload for variables that are not part of the POWER weather model.
ALTER TABLE "ClimateDaily" ADD COLUMN "measurements" JSONB;

-- Retention and source lookups must distinguish independent real and synthetic datasets.
DROP INDEX "DatasetRun_districtId_status_retrievedAt_idx";
CREATE INDEX "DatasetRun_districtId_source_isSynthetic_status_retrievedAt_idx"
  ON "DatasetRun"("districtId", "source", "isSynthetic", "status", "retrievedAt");

-- Allow provider grid-cell datasets to exist independently of district registration.
-- Existing district-linked observations remain intact.
ALTER TABLE "DatasetRun" ALTER COLUMN "districtId" DROP NOT NULL;
ALTER TABLE "ClimateDaily" ALTER COLUMN "districtId" DROP NOT NULL;

ALTER TABLE "DatasetRun" DROP CONSTRAINT IF EXISTS "DatasetRun_districtId_fkey";
ALTER TABLE "DatasetRun" ADD CONSTRAINT "DatasetRun_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClimateDaily" DROP CONSTRAINT IF EXISTS "ClimateDaily_districtId_fkey";
ALTER TABLE "ClimateDaily" ADD CONSTRAINT "ClimateDaily_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

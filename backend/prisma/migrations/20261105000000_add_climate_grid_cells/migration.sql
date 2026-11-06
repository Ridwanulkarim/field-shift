-- Additive migration: records which provider grid cell a dataset run describes.
-- Existing rows and columns are untouched. DatasetRun.gridCellId stays NULL until the backfill script
-- (npm run db:backfill-cells) or a new ingestion sets it.

-- CreateTable
CREATE TABLE "ClimateGridCell" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "cellKey" TEXT NOT NULL,
    "gridName" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLon" DOUBLE PRECISION NOT NULL,
    "resLatDeg" DOUBLE PRECISION NOT NULL,
    "resLonDeg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClimateGridCell_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DatasetRun" ADD COLUMN "gridCellId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ClimateGridCell_provider_cellKey_key" ON "ClimateGridCell"("provider", "cellKey");

-- CreateIndex
CREATE INDEX "DatasetRun_gridCellId_status_isSynthetic_retrievedAt_idx" ON "DatasetRun"("gridCellId", "status", "isSynthetic", "retrievedAt");

-- AddForeignKey
ALTER TABLE "DatasetRun" ADD CONSTRAINT "DatasetRun_gridCellId_fkey" FOREIGN KEY ("gridCellId") REFERENCES "ClimateGridCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

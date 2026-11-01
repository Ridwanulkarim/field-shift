-- Neon/PostgreSQL installations require the PostGIS extension before geometry
-- columns and spatial indexes can be created.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateTable
CREATE TABLE "Field" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" INTEGER NOT NULL,
    "boundary" geometry(MultiPolygon,4326),
    "areaHa" DOUBLE PRECISION,
    "soilType" TEXT,
    "soilPh" DOUBLE PRECISION,
    "organicMatterPct" DOUBLE PRECISION,
    "salinityDsM" DOUBLE PRECISION,
    "irrigationSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- Create spatial index for field boundary queries
CREATE INDEX "Field_boundary_idx"
ON "Field"
USING GIST ("boundary");

-- CreateIndex
CREATE INDEX "Field_districtId_idx"
ON "Field"("districtId");

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

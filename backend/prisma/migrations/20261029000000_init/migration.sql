-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "coordNote" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameBn" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "isLegume" BOOLEAN NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,
    "waterNeedMmMin" INTEGER NOT NULL,
    "waterNeedMmMax" INTEGER NOT NULL,
    "heatThresholdC" DOUBLE PRECISION NOT NULL,
    "heatSensitivity" INTEGER NOT NULL,
    "salinityTolerance" INTEGER NOT NULL,
    "waterloggingTolerance" INTEGER NOT NULL,
    "inputIntensity" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRun" (
    "id" SERIAL NOT NULL,
    "districtId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "product" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "status" "RunStatus" NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "requestParams" JSONB NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "fillValue" DOUBLE PRECISION,
    "units" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "notes" TEXT,

    CONSTRAINT "DatasetRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateDaily" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "precipMm" DOUBLE PRECISION,
    "tMaxC" DOUBLE PRECISION,
    "tMinC" DOUBLE PRECISION,

    CONSTRAINT "ClimateDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_slug_key" ON "Crop"("slug");

-- CreateIndex
CREATE INDEX "DatasetRun_districtId_status_retrievedAt_idx" ON "DatasetRun"("districtId", "status", "retrievedAt");

-- CreateIndex
CREATE INDEX "ClimateDaily_districtId_date_idx" ON "ClimateDaily"("districtId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateDaily_runId_date_key" ON "ClimateDaily"("runId", "date");

-- AddForeignKey
ALTER TABLE "DatasetRun" ADD CONSTRAINT "DatasetRun_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateDaily" ADD CONSTRAINT "ClimateDaily_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DatasetRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateDaily" ADD CONSTRAINT "ClimateDaily_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

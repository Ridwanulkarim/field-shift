-- Coordinates ingestion jobs so overlapping workers cannot replace one another.
CREATE TABLE "DatasetIngestionLock" (
    "key" TEXT NOT NULL,
    "owner" UUID NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetIngestionLock_pkey" PRIMARY KEY ("key")
);

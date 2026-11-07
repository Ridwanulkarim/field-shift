-- Additive: one nullable column holding per-trait source records. Existing rows and data are untouched.
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "traitSources" JSONB;

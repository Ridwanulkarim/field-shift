-- Each anonymous browser session may own at most one field.
ALTER TABLE "Field" ADD COLUMN "sessionId" VARCHAR(64);

-- Existing fields predate anonymous ownership. They must be assigned by an
-- operator before this column can become mandatory in a deployed database.
CREATE UNIQUE INDEX "Field_sessionId_key" ON "Field"("sessionId");

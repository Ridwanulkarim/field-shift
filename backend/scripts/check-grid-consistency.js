// Offline, read-only check of the assumed NASA POWER grid against the data ALREADY STORED in your database.
// If the assumed grid is right, two districts in the same cell have identical series, and districts in
// different cells have different series. A contradiction means the grid constants are wrong.
// It can refute the assumption but cannot prove it exactly (see `npm run check:power-grid` for the edge probe).
//
// Usage: npm run check:grid-consistency     (run `npm run db:backfill-cells` first)

import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { compareGroupings } from '../src/geo/gridProbe.js';

const prisma = createPrismaClient(config.databaseUrl);
try {
  const rows = await prisma.$queryRaw`
    WITH latest AS (
      SELECT DISTINCT ON (r."districtId") r."id", r."districtId", r."gridCellId"
      FROM "DatasetRun" r
      WHERE r."status" = 'SUCCESS' AND r."isSynthetic" = false AND r."source" = 'NASA POWER' AND r."gridCellId" IS NOT NULL
      ORDER BY r."districtId", r."retrievedAt" DESC, r."id" DESC
    )
    SELECT d."slug", c."cellKey",
           md5(string_agg(concat_ws('|', cd."date"::text, cd."precipMm"::text, cd."tMaxC"::text, cd."tMinC"::text), ',' ORDER BY cd."date")) AS "fingerprint",
           count(*)::int AS "rows"
    FROM latest l
    JOIN "District" d ON d."id" = l."districtId"
    JOIN "ClimateGridCell" c ON c."id" = l."gridCellId"
    JOIN "ClimateDaily" cd ON cd."runId" = l."id"
    GROUP BY d."slug", c."cellKey"
    ORDER BY c."cellKey", d."slug"`;
  if (rows.length < 2) {
    console.log('Need at least two districts with a stored real run and a grid cell. Run db:backfill-cells first.');
    process.exit(1);
  }
  for (const r of rows) console.log(`  ${r.slug.padEnd(12)} cell ${r.cellKey.padEnd(7)} ${r.rows} rows  data ${r.fingerprint.slice(0, 8)}`);
  const result = compareGroupings(rows);
  for (const [a, b] of result.sameCellDifferentData) console.log(`CONTRADICTION: ${a} and ${b} are in the same assumed cell but their data differ.`);
  for (const [a, b] of result.sameDataDifferentCell) console.log(`CONTRADICTION: ${a} and ${b} have identical data but are in different assumed cells.`);
  console.log(result.consistent
    ? '\nRESULT: consistent. Cell membership of all stored districts matches the assumed grid. (This does not prove the exact edge positions.)'
    : '\nRESULT: INCONSISTENT with the assumed grid. Do not trust field-to-cell mapping until the grid constants are corrected.');
  process.exit(result.consistent ? 0 : 1);
} finally {
  await prisma.$disconnect();
}

// Downloads NASA POWER data for every grid cell that contains a registered field but has no stored real
// data yet. Each cell is requested once, at its centre, and shared by every field inside it.
//
// Usage:
//   npm run ingest:field-cells -- --dry-run      list the cells that would be ingested; downloads nothing
//   npm run ingest:field-cells                   ingest every missing cell (2001-01-01 to the end of last year)
//   npm run ingest:field-cells -- --start=2001 --delay=2000
//
// Cells that already have real data (from a district or an earlier cell ingestion) are skipped. A failure is
// recorded as a FAILED run and the script keeps going; it exits 1 if any cell failed.
// `npm run ingest:refresh` then extends these cells to within a week of today.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { listFieldCells, cellHasRealRun } from '../src/data/climateStore.js';
import { ingestGridCell } from '../src/integrations/nasa/ingest.js';
import { fetchPowerDaily } from '../src/integrations/nasa/power.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' }, start: { type: 'string' }, delay: { type: 'string' } } });
const startYear = Number(values.start ?? 2001);
const delayMs = Number(values.delay ?? 2000);
const endYear = new Date().getUTCFullYear() - 1;
if (!Number.isInteger(startYear) || startYear < 1981 || startYear > endYear || !Number.isInteger(delayMs) || delayMs < 0) {
  console.error('Invalid --start or --delay.');
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
const fetchPower = (args) => fetchPowerDaily(args, { timeoutMs: config.nasaPowerTimeoutMs, retries: config.nasaPowerRetries });
let failures = 0;

try {
  const occupied = await listFieldCells(prisma);
  const missing = [];
  for (const entry of occupied) {
    if (!(await cellHasRealRun(prisma, entry.cell))) missing.push(entry);
  }
  console.log(`${occupied.length} cell(s) hold registered fields; ${missing.length} have no real NASA POWER data yet.`);
  for (const { cell, fieldCount } of missing) {
    console.log(`  cell ${cell.cellKey} (centre ${cell.centerLat}, ${cell.centerLon}) - ${fieldCount} field(s)`);
  }
  if (!values['dry-run']) {
    for (const [i, { cell }] of missing.entries()) {
      const result = await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: `${startYear}-01-01`, endDate: `${endYear}-12-31`, fetchPower });
      if (result.ok && result.skipped) console.log(`cell ${cell.cellKey}: SKIPPED ${result.reason}`);
      else if (result.ok) console.log(`cell ${cell.cellKey}: stored ${result.rows} rows`);
      else if (result.skipped) console.log(`cell ${cell.cellKey}: SKIPPED ${result.error}`);
      else {
        failures += 1;
        console.log(`cell ${cell.cellKey}: FAILED ${result.error}`);
      }
      if (i < missing.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  await prisma.$disconnect();
}

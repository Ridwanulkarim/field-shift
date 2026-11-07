// Downloads NASA GPM IMERG daily precipitation at its NATIVE 0.1 degree resolution and stores every pixel on its own
// (see src/integrations/nasa/imergIngest.js). Nothing is averaged while storing. A NASA POWER cell (or a point) only
// chooses WHICH pixels are read; comparing with POWER is a separate, read-time step.
//
// Usage:
//   npm run ingest:imerg:cells -- --dry-run                    show coverage, the blocks and what is already stored
//   npm run ingest:imerg:cells -- --cell=49:430                the ~35 pixels inside one NASA POWER cell (e.g. Rajshahi's)
//   npm run ingest:imerg:cells -- --point=24.37,88.6           the single pixel containing a point
//   npm run ingest:imerg:cells                                 the pixels of every POWER cell that holds a registered field
//   npm run ingest:imerg:cells -- --start=2001 --end=2025-09-30 --concurrency=4
//
// --start takes a year or a date. The default is 2001-01-01 (the NASA POWER series starts there). The start is NOT limited
// by a fixed date in this script: the first and last available day are read from NASA CMR and shown, and a start before
// the first available day is moved up to it. Re-running is safe and cheap: days already stored are skipped, so it only
// fetches what is missing, which is also how new Final-Run days are picked up (they appear up to about 4 months late).
// A failure is recorded as a FAILED run; the script exits 1 if any block failed.
//
// Needs EARTHDATA_TOKEN in the environment (backend/.env). The token is never printed.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { listFieldCells } from '../src/data/climateStore.js';
import { imergBlockForPoint, imergPixelList, imergPixelsInCell, IMERG_PROVIDER } from '../src/geo/imergGrid.js';
import { fetchImergDay, getImergCoverage, listImergGranules } from '../src/integrations/nasa/imerg.js';
import { ingestImergBlock } from '../src/integrations/nasa/imergIngest.js';
import { resolvePowerCell } from '../src/integrations/nasa/ingest.js';

const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean' }, cell: { type: 'string' }, point: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, concurrency: { type: 'string' } },
});
const today = new Date().toISOString().slice(0, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const startArg = values.start ?? '2001';
const startDate = /^\d{4}$/.test(startArg) ? `${startArg}-01-01` : startArg;
const endDate = values.end ?? today;
const concurrency = Number(values.concurrency ?? config.imergConcurrency);
if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
  console.error('--start must be a year or YYYY-MM-DD and --end a real date YYYY-MM-DD, with start not after end.');
  process.exit(1);
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
  console.error('--concurrency must be a whole number from 1 to 16.');
  process.exit(1);
}
if (values.cell && values.point) {
  console.error('Use either --cell or --point, not both.');
  process.exit(1);
}
const dryRun = Boolean(values['dry-run']);
if (!dryRun && !config.earthdataToken) {
  console.error('EARTHDATA_TOKEN is not set. Put it in backend/.env (see .env.example). Nothing was downloaded.');
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
const fetchDay = ({ granule, block }) => fetchImergDay({ granule, block, token: config.earthdataToken }, { timeoutMs: config.imergTimeoutMs });
let failures = 0;

try {
  // What NASA CMR actually has: nothing about the coverage is assumed.
  let effectiveStart = startDate;
  try {
    const cov = await getImergCoverage();
    console.log(`CMR coverage of GPM_3IMERGDF collection 07: ${cov.firstDate} (file ${cov.firstFileVersion}) to ${cov.lastDate} (file ${cov.lastFileVersion})`);
    if (effectiveStart < cov.firstDate) {
      console.log(`--start ${effectiveStart} is before the first available day; using ${cov.firstDate}.`);
      effectiveStart = cov.firstDate;
    }
  } catch (err) {
    console.log(`Could not read the coverage from CMR (${err.message}); continuing with the requested dates.`);
  }

  // Blocks to ingest.
  const blocks = [];
  if (values.point) {
    const [lat, lon] = values.point.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      console.error('--point must be "lat,lon", for example --point=24.37,88.6');
      process.exit(1);
    }
    blocks.push({ label: `point ${lat},${lon}`, block: imergBlockForPoint(lat, lon) });
  } else if (values.cell) {
    const cell = await resolvePowerCell(prisma, values.cell);
    blocks.push({ label: `POWER cell ${cell.cellKey}`, block: imergPixelsInCell(cell) });
  } else {
    for (const { cell } of await listFieldCells(prisma)) blocks.push({ label: `POWER cell ${cell.cellKey}`, block: imergPixelsInCell(cell) });
  }
  console.log(`${blocks.length} pixel block(s) selected.`);

  for (const { label, block } of blocks) {
    const keys = imergPixelList(block).map((p) => p.cellKey);
    const runs = await prisma.datasetRun.findMany({
      where: { source: IMERG_PROVIDER, isSynthetic: false, status: 'SUCCESS', gridCell: { provider: IMERG_PROVIDER, cellKey: { in: keys } } },
      select: { endDate: true, rowCount: true },
    });
    const stored = runs.length === 0 ? 'nothing stored' : `${runs.length}/${keys.length} pixels stored, up to ${runs.map((r) => r.endDate).sort().at(0).toISOString().slice(0, 10)} (shortest)`;
    console.log(`  ${label}: ${block.pixelCount} native pixels, ${stored}`);
  }

  if (!dryRun) {
    for (const { label, block } of blocks) {
      const result = await ingestImergBlock({
        prisma, block, startDate: effectiveStart, endDate,
        listGranules: ({ startDate: s, endDate: e }) => listImergGranules({ startDate: s, endDate: e }),
        fetchDay, concurrency,
        onProgress: ({ done, total, failed }) => console.log(`  ${label}: ${done}/${total} days${failed ? `, ${failed} failed (will be retried next run)` : ''}`),
      });
      if (result.ok && result.skipped) console.log(`${label}: SKIPPED ${result.reason}`);
      else if (result.ok) console.log(`${label}: fetched ${result.fetched} days for ${result.pixels} pixels, ${result.failed} failed, through ${result.through}`);
      else if (result.skipped) console.log(`${label}: SKIPPED ${result.error}`);
      else {
        failures += 1;
        console.log(`${label}: FAILED ${result.error}`);
      }
    }
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  await prisma.$disconnect();
}

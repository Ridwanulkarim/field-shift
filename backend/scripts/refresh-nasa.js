// Extends each real NASA POWER run through about seven days before today.
// A failed fetch is recorded and never replaces the existing successful run.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { refreshDistrict } from '../src/integrations/nasa/ingest.js';
import { fetchPowerDaily } from '../src/integrations/nasa/power.js';

const { values } = parseArgs({ options: { delay: { type: 'string' }, lag: { type: 'string' }, overlap: { type: 'string' } } });
const delayMs = Number(values.delay ?? 2000);
const lagDays = Number(values.lag ?? 7);
const overlapDays = Number(values.overlap ?? 2);
if (!Number.isInteger(delayMs) || delayMs < 0 || !Number.isInteger(lagDays) || lagDays < 1 || !Number.isInteger(overlapDays) || overlapDays < 0) {
  console.error('Invalid --delay, --lag, or --overlap.');
  process.exit(1);
}
const prisma = createPrismaClient(config.databaseUrl);
const fetchPower = (args) => fetchPowerDaily(args, {
  timeoutMs: config.nasaPowerTimeoutMs,
  retries: config.nasaPowerRetries,
});
let failures = 0;

try {
  const districts = await prisma.district.findMany({ orderBy: { slug: 'asc' } });
  for (const [i, district] of districts.entries()) {
    const result = await refreshDistrict({ prisma, district, lagDays, overlapDays, fetchPower });
    if (result.ok && result.skipped && result.reason === 'already_current') console.log(`${district.slug}: already current through ${result.through}`);
    else if (result.skipped) console.log(`${district.slug}: SKIPPED ${result.error}`);
    else if (result.ok) console.log(`${district.slug}: refreshed ${result.rows} rows`);
    else {
      failures += 1;
      console.log(`${district.slug}: FAILED ${result.error}`);
    }
    if (i < districts.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  await prisma.$disconnect();
}

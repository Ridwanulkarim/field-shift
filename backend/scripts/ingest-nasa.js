// Downloads NASA POWER daily data for the pilot districts and stores it with provenance.
// Needs internet access to power.larc.nasa.gov. No API key is required.
//
// Usage:
//   npm run ingest:nasa
//   npm run ingest:nasa -- --district=rajshahi            (one district)
//   npm run ingest:nasa -- --start=2001 --end=2025        (year range)
//
// POWER asks users not to hammer the service, so districts are fetched one after another
// with a pause between requests.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { ingestDistrict } from '../src/integrations/nasa/ingest.js';

const { values } = parseArgs({
  options: {
    district: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    delay: { type: 'string' },
  },
});
const startYear = Number(values.start ?? 2001);
const endYear = Number(values.end ?? new Date().getUTCFullYear() - 1);
const delayMs = Number(values.delay ?? 2000);

if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1981 || endYear < startYear) {
  console.error('Invalid --start/--end. POWER daily data begins in 1981; end must not be before start.');
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
let failures = 0;
try {
  const where = values.district ? { slug: { in: values.district.split(',') } } : {};
  const districts = await prisma.district.findMany({ where, orderBy: { slug: 'asc' } });
  if (districts.length === 0) {
    console.error('No districts found. Run `npm run db:seed` first.');
    process.exit(1);
  }
  console.log(`Fetching NASA POWER daily data ${startYear}-${endYear} for ${districts.length} district(s)...`);
  for (const [i, d] of districts.entries()) {
    process.stdout.write(`[${i + 1}/${districts.length}] ${d.slug} ... `);
    const r = await ingestDistrict({ prisma, district: d, startYear, endYear });
    if (r.ok) {
      console.log(`OK  ${r.rows} days, ${r.missingCount} missing values`);
      for (const w of r.warnings) console.log(`      note: ${w}`);
    } else {
      failures += 1;
      console.log(`FAILED  ${r.error}`);
    }
    if (i < districts.length - 1) await new Promise((res) => setTimeout(res, delayMs));
  }
  console.log(failures === 0 ? '\nDone. All districts ingested.' : `\nDone with ${failures} failure(s). Failed attempts are recorded; see /api/health/data.`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  await prisma.$disconnect();
}

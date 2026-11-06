// Confirms every district serves real NASA POWER data that is not stale.
// Exit code 0 = healthy, 1 = at least one district is missing, synthetic-only, or stale.
// Usage: npm run verify:live            (default: max age 21 days)
//        npm run verify:live -- --max-age=14

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { checkLiveData, DEFAULT_MAX_AGE_DAYS } from '../src/data/liveDataCheck.js';

const { values } = parseArgs({ options: { 'max-age': { type: 'string' } } });
const maxAgeDays = Number(values['max-age'] ?? DEFAULT_MAX_AGE_DAYS);
if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1) {
  console.error('Invalid --max-age. Use a whole number of days.');
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
try {
  const districts = await createRepository(prisma).listDistricts();
  const result = checkLiveData(districts, { maxAgeDays });
  for (const r of result.rows) {
    console.log(`${r.slug.padEnd(14)} ${r.state.padEnd(14)} latest=${r.latestObservationDate ?? '-'}${r.ageDays !== null ? ` (${r.ageDays}d old)` : ''}`);
  }
  console.log(result.ok ? '\nAll districts are on live NASA POWER data.' : `\nNOT HEALTHY:\n  ${result.problems.join('\n  ') || 'no districts found (run db:seed)'}`);
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await prisma.$disconnect();
}

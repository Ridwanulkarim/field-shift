// For each year: rain in 1-7 May, in all of May, and the wettest 7-day window in May.
// Also prints what POWER reported about its own sources. Read-only.
// Usage: node --env-file-if-exists=.env scripts/inspect-early-rain.js --district=rajshahi
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { indexSeries, windowSum, addDays } from '../src/science/series.js';

const { values } = parseArgs({ options: { district: { type: 'string' } } });
const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);
try {
  const district = (await repository.listDistricts()).find((d) => d.slug === values.district);
  if (!district) throw new Error('Pass --district=<slug>.');
  const climate = await repository.getClimate(district.id);
  if (!climate) throw new Error('No climate data for this district.');
  const index = indexSeries(climate.series);
  const rows = [];
  for (let year = 2001; year <= 2025; year += 1) {
    const may = windowSum(index, `${year}-05-01`, 31, 'precipMm', 31).sum;
    const first = windowSum(index, `${year}-05-01`, 7, 'precipMm', 7).sum;
    let best = 0;
    for (let d = `${year}-05-01`; d <= `${year}-05-25`; d = addDays(d, 1)) {
      const w = windowSum(index, d, 7, 'precipMm', 7).sum;
      if (w !== null && w > best) best = w;
    }
    rows.push({ year, mm_1to7May: first === null ? null : Math.round(first), mm_May: may === null ? null : Math.round(may), wettest7dayInMay: Math.round(best) });
  }
  console.table(rows);
  console.log('\nPOWER provenance notes stored with this run:\n', climate.provenance.notes);
  console.log('\nProduct title:', climate.provenance.product, '| retrieved:', climate.provenance.retrievedAt);
} finally {
  await prisma.$disconnect();
}

// Report whether usable-rain onset differs between the early and late parts of each district series.
// Usage: npm run analyze:onset -- --district=rajshahi --split=2013

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { yearlyMonsoonOnset } from '../src/science/climate.js';
import { analyzeOnsetShift } from '../src/science/onsetAnalysis.js';

const { values } = parseArgs({
  options: {
    district: { type: 'string' },
    split: { type: 'string' },
  },
});
const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);

try {
  const districts = await repository.listDistricts();
  const selected = values.district
    ? districts.filter((district) => values.district.split(',').includes(district.slug))
    : districts;
  if (!selected.length) throw new Error('No matching districts found.');
  const splitYear = values.split === undefined ? null : Number(values.split);
  if (splitYear !== null && !Number.isInteger(splitYear)) throw new Error('--split must be a whole year.');
  for (const district of selected) {
    const climate = await repository.getClimate(district.id);
    if (!climate) {
      console.log(`${district.slug}: no climate data`);
      continue;
    }
    const yearly = yearlyMonsoonOnset(climate.series);
    const result = analyzeOnsetShift(yearly, { splitYear });
    console.log(JSON.stringify({
      district: district.slug,
      source: climate.provenance.source,
      isSynthetic: climate.provenance.isSynthetic,
      ...result,
    }));
  }
} finally {
  await prisma.$disconnect();
}

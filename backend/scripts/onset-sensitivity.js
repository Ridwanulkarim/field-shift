// Prints the onset shift under many onset definitions, plus the yearly onset dates for the
// default definition. Usage: npm run analyze:sensitivity -- --district=rajshahi --split=2013
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { monsoonOnsetByYear } from '../src/science/climate.js';
import { onsetSensitivity } from '../src/science/onsetSensitivity.js';

const { values } = parseArgs({ options: { district: { type: 'string' }, split: { type: 'string' } } });
const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);
try {
  const district = (await repository.listDistricts()).find((d) => d.slug === values.district);
  if (!district) throw new Error('Pass --district=<slug>.');
  const climate = await repository.getClimate(district.id);
  if (!climate) throw new Error('No climate data for this district.');
  const splitYear = values.split === undefined ? null : Number(values.split);
  console.log(`${district.slug} | source: ${climate.provenance.source} | synthetic: ${climate.provenance.isSynthetic}`);
  console.log('\nYearly onset, default definition (year: status, day of year on a 365-day calendar):');
  console.log(monsoonOnsetByYear(climate.series).map((p) => `${p.year}: ${p.status}${p.value ? ` d${p.value}` : ''}`).join('\n'));
  console.log('\nSensitivity (shift = late median - early median, days; negative = earlier):');
  console.table(onsetSensitivity(climate.series, { splitYear }).map((r) => ({
    start: r.startMonth === 5 ? '1 May' : '1 Jun', window: r.windowDays, mm: r.thresholdMm,
    early: r.earlyMedian, late: r.lateMedian, shift: r.shiftDays, p: r.pValue === null ? null : Number(r.pValue.toFixed(4)),
    verdict: r.verdict, cens: r.censoredYears, excl: r.excludedYears,
  })));
} finally {
  await prisma.$disconnect();
}

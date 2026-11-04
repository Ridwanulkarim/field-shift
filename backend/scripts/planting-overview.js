// Read-only overview: what does the planting-window analysis say for every district and onset crop?
// It calls the same service method as the API route, so the numbers match the endpoint exactly.
// Usage: npm run analyze:planting
//        npm run analyze:planting -- --split=2013 --crop=aus

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { createEvaluationService } from '../src/services/evaluationService.js';
import { ONSET_BY_CROP } from '../src/science/rules.js';
import { dayOfYearFixed365 } from '../src/science/series.js';

const { values } = parseArgs({ options: { split: { type: 'string' }, crop: { type: 'string' } } });
const splitYear = values.split === undefined ? null : Number(values.split);
if (splitYear !== null && !Number.isInteger(splitYear)) {
  console.error('--split must be a whole year.');
  process.exit(1);
}
const crops = values.crop ? values.crop.split(',') : Object.keys(ONSET_BY_CROP);

const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);
const service = createEvaluationService(repository);

try {
  const rows = [];
  for (const district of await repository.listDistricts()) {
    for (const crop of crops) {
      try {
        const r = await service.plantingWindow(district.slug, { crop, splitYear });
        const a = r.onset.analysis;
        // Years whose onset sits on the very first day the search allows: the true onset may be earlier.
        const startDay = dayOfYearFixed365(`2001-${String(r.onset.definition.startMonth).padStart(2, '0')}-01`);
        const atStart = (from, to) => r.onset.yearly.filter((y) => y.year >= from && y.year <= to && y.value === startDay).length;
        rows.push({
          district: district.slug,
          crop,
          early: a.earlyMedian,
          late: a.lateMedian,
          shift: a.shiftDays,
          p: a.test ? Number(a.test.pValue.toFixed(4)) : null,
          robust: r.onset.sensitivity.agreeingShare,
          decision: `${r.recommendation.action}${r.recommendation.shiftDays ? ` ${r.recommendation.shiftDays}d` : ''}`,
          confidence: r.recommendation.confidence,
          atStartEarly: `${atStart(r.periods.early.from, r.periods.early.to)}/${a.earlyYears}`,
          atStartLate: `${atStart(r.periods.late.from, r.periods.late.to)}/${a.lateYears}`,
          data: r.provenance.isSynthetic ? 'SYNTHETIC' : r.provenance.source,
        });
      } catch (err) {
        rows.push({ district: district.slug, crop, decision: `ERROR ${err.code ?? err.message}` });
      }
    }
  }
  console.log('shift = late median - early median (days, negative = earlier); robust = share of the 15 definitions that agree;');
  console.log('atStart = years whose onset fell on the first allowed day (true onset may be earlier).');
  console.table(rows);
} finally {
  await prisma.$disconnect();
}
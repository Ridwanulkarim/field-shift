// Read-only screening: runs the advisory for every district that has real stored data and for every crop with an onset rule,
// and prints ONE table, with a multiple-testing correction. It calls the same service method as the API route.
// Nothing is written to the database. Use it to decide which district and crop deserve a closer look, not as a result.
//
//   npm run screen:advisory
//   npm run screen:advisory -- --crop=aman --split=2013
//   npm run screen:advisory -- --json        (machine-readable, for a file)

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { createEvaluationService } from '../src/services/evaluationService.js';
import { ONSET_BY_CROP } from '../src/science/rules.js';
import { screenRow, summarizeScreen } from '../src/science/screening.js';

const { values } = parseArgs({ options: { split: { type: 'string' }, crop: { type: 'string' }, json: { type: 'boolean' } } });
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
        const adv = await service.advisory(district.slug, { crop, splitYear, lang: 'en', usual: null, includeHeat: false });
        rows.push(screenRow(adv));
      } catch (err) {
        if (err.code === 'NO_REAL_CLIMATE_DATA') rows.push({ district: district.slug, crop, notIngested: true });
        else throw err;
      }
    }
  }
  const result = summarizeScreen(rows);
  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const pad = (v, n) => String(v ?? '-').padEnd(n);
    const pct = (x) => (x === null || x === undefined ? '-' : `${Math.round(x * 100)}%`);
    console.log(['district', 'crop', 'verdict', 'shift', '95% interval', 'p', 'Holm p', 'defs', 'at start e/l', 'years e/l'].map((h, i) => pad(h, [14, 6, 28, 6, 12, 7, 7, 6, 13, 9][i])).join(' '));
    for (const r of result.rows) {
      const interval = r.interval95Days ? `${r.interval95Days[0]}..${r.interval95Days[1]}` : '-';
      console.log([
        pad(r.district, 14), pad(r.crop, 6), pad(r.verdict, 28), pad(r.shiftDays ?? '-', 6), pad(interval, 12),
        pad(r.pValue ?? '-', 7), pad(r.holmPValue === undefined ? '-' : Math.round(r.holmPValue * 10000) / 10000, 7),
        pad(r.definitionsUsable ? `${r.definitionsAgreeing}/${r.definitionsUsable}` : '-', 6),
        pad(`${pct(r.earlyAtStartShare)}/${pct(r.lateAtStartShare)}`, 13), pad(r.earlyYears ? `${r.earlyYears}/${r.lateYears}` : '-', 9),
      ].join(' '));
    }
    console.log(`\nFamily of ${result.familySize} test(s): ${result.rawSignificant} below p 0.05 before correction, ${result.survivingCorrection} after the Holm correction; about ${result.expectedFalseAlarmsIfNoRealChange} would be expected by chance alone.`);
    for (const c of result.caveats) console.log(`- ${c}`);
  }
} finally {
  await prisma.$disconnect();
}

// Read-only screen of the OTHER yearly climate indicators (monsoon rainfall, dry-season rainfall, hot days Mar-May, longest
// dry spell Nov-Mar, usable-rain onset) for every district that has real stored data, comparing the early years with the
// later years (default split 2013, the same as the advisory), with a Holm correction over the whole family.
// Use it to decide whether ANY indicator deserves a demo story. Nothing is written. Works from the database or, with OFFLINE=1
// (or no database), from the committed offline files.
//
//   npm run screen:indicators
//   npm run screen:indicators -- --split=2013 --district=rajshahi
//
// A small p-value after correction is a lead to examine, not a finding: the series are 25 years of one modelled source.
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createDataSource } from '../src/data/dataSource.js';
import { climateIndicators } from '../src/science/climate.js';
import { mannWhitney } from '../src/science/onsetAnalysis.js';
import { holmAdjust, ALPHA } from '../src/science/screening.js';
import { PLANTING_SPLIT_YEAR } from '../src/science/rules.js';

const { values } = parseArgs({ options: { split: { type: 'string' }, district: { type: 'string' } } });
const split = values.split === undefined ? PLANTING_SPLIT_YEAR : Number(values.split);
if (!Number.isInteger(split)) { console.error('--split must be a whole year.'); process.exit(1); }

async function createDatabaseRepository(url) {
  const { createPrismaClient } = await import('../src/data/prisma.js');
  const { createRepository } = await import('../src/data/repository.js');
  const prisma = createPrismaClient(url);
  return { repository: createRepository(prisma), close: () => prisma.$disconnect() };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const source = await createDataSource(config, { createDatabaseRepository });
try {
  if (!source.repository) { console.error('No database and no offline files. See docs/OFFLINE.md.'); process.exit(1); }
  const rows = [];
  for (const d of await source.repository.listDistricts()) {
    if (values.district && d.slug !== values.district) continue;
    const climate = await source.repository.getClimate(d.id);
    if (!climate || climate.provenance.isSynthetic) continue;
    for (const ind of climateIndicators(climate.series)) {
      const early = ind.yearly.filter((p) => p.year < split && Number.isFinite(p.value)).map((p) => p.value);
      const late = ind.yearly.filter((p) => p.year >= split && Number.isFinite(p.value)).map((p) => p.value);
      if (early.length < 5 || late.length < 5) { rows.push({ district: d.slug, indicator: ind.id, unit: ind.unit, skipped: `only ${early.length}/${late.length} usable years` }); continue; }
      const mw = mannWhitney(early, late);
      rows.push({ district: d.slug, indicator: ind.id, unit: ind.unit, early: early.length, late: late.length, earlyMedian: median(early), lateMedian: median(late), p: Number.isFinite(mw?.pValue) ? mw.pValue : 1 }); // identical values in both periods -> no difference (p = 1)
    }
  }
  const adj = holmAdjust(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = adj[i]; });
  const pad = (v, n) => String(v ?? '-').padEnd(n);
  const r2 = (x) => (x === undefined ? '-' : Math.round(x * 100) / 100);
  console.log(`data: ${source.mode}; early < ${split} <= late; Mann-Whitney, Holm-corrected over ${adj.filter((x) => x !== null).length} tests`);
  console.log(['district', 'indicator', 'unit', 'yrs e/l', 'median early', 'median late', 'p', 'Holm p'].map((h, i) => pad(h, [14, 20, 12, 8, 13, 12, 8, 8][i])).join(' '));
  for (const r of rows) {
    console.log(r.skipped
      ? `${pad(r.district, 14)} ${pad(r.indicator, 20)} skipped: ${r.skipped}`
      : [pad(r.district, 14), pad(r.indicator, 20), pad(r.unit, 12), pad(`${r.early}/${r.late}`, 8), pad(r2(r.earlyMedian), 13), pad(r2(r.lateMedian), 12), pad(r2(r.p), 8), pad(r2(r.holm), 8)].join(' '));
  }
  const tested = rows.filter((r) => r.p !== undefined);
  const raw = tested.filter((r) => r.p < ALPHA).length;
  const kept = tested.filter((r) => r.holm < ALPHA);
  console.log(`\n${tested.length} tests: ${raw} below p ${ALPHA} before correction (about ${Math.round(tested.length * ALPHA * 10) / 10} expected by chance alone), ${kept.length} after the Holm correction.`);
  for (const r of kept) console.log(`  survives: ${r.district} ${r.indicator} (median ${r2(r.earlyMedian)} -> ${r2(r.lateMedian)} ${r.unit}, Holm p ${r2(r.holm)})`);
  if (kept.length === 0) console.log('Nothing survives the correction: build the demo around "no clear change, here is the uncertainty".');
  console.log('Districts that share a NASA grid cell (e.g. Jashore and Khulna) are not independent: count them once.');
} finally {
  await source.close();
}

// Compares the usable-rain onset that NASA POWER and CHIRPS (via ClimateSERV) give, year by year, for Aman and Aus, using
// the project's own onset rule (monsoonOnsetByYear + analyzeOnsetShift). No database and no network: it reads the committed
// offline POWER file and the CHIRPS file made by `npm run fetch:chirps`.
//
//   npm run compare:chirps -- --district=rajshahi
//   npm run compare:chirps -- --district=all
// It prints the tables and writes data/chirps/compare-<district>.json. It reports numbers and does NOT declare "agree" or
// "disagree": decide that yourself from the year-by-year differences. Neither source is ground truth.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { loadOfflineStore, rowsToSeries, DEFAULT_OFFLINE_DIR } from '../src/data/offlineStore.js';
import { loadChirpsFile, DEFAULT_CHIRPS_DIR } from '../src/data/chirpsStore.js';
import { monsoonOnsetByYear } from '../src/science/climate.js';
import { ONSET_BY_CROP } from '../src/science/rules.js';
import { compareOnsetSeries, compareShiftVerdicts, firstDayShare, lagCorrelations } from '../src/science/sourceComparison.js';
import { dayOfYearFixed365 } from '../src/science/series.js';

const { values } = parseArgs({ options: { district: { type: 'string', default: 'rajshahi' }, chirps: { type: 'string', default: DEFAULT_CHIRPS_DIR } } });
const store = loadOfflineStore(config.offlineDataDir || DEFAULT_OFFLINE_DIR);
const targets = values.district === 'all' ? DISTRICTS.map((d) => d.slug) : [values.district];
const overview = [];

for (const slug of targets) {
  const power = store.entries.get(slug);
  if (!power) { console.error(`${slug}: no offline POWER file (run npm run check:offline).`); continue; }
  let chirps;
  try { chirps = loadChirpsFile(slug, values.chirps); } catch (error) { console.error(`${slug}: ${error.message}`); continue; }

  // Compare only the days both sources cover.
  const first = chirps.series[0].date > power.rows[0][0] ? chirps.series[0].date : power.rows[0][0];
  const last = chirps.series.at(-1).date < power.rows.at(-1)[0] ? chirps.series.at(-1).date : power.rows.at(-1)[0];
  const within = (s) => s.filter((r) => r.date >= first && r.date <= last);
  const powerSeries = within(rowsToSeries(power.rows));
  const chirpsSeries = within(chirps.series);

  // Are the two calendars aligned? (best lag should be 0; see lagCorrelations)
  const alignment = lagCorrelations(powerSeries, chirpsSeries);
  console.log(`\n--- ${slug}: daily rainfall correlation, CHIRPS shifted by lag days (best lag ${alignment.bestLag}; 0 means the dates line up) ---`);
  console.table(alignment.correlations);
  const report = {
    district: slug, comparedRange: { first, last },
    powerRetrievedAt: power.provenance.retrievedAt, powerSeriesSha256: power.seriesSha256,
    chirpsRetrievedAt: chirps.file.provenance.retrievedAt, chirpsSha256: chirps.file.sha256,
    dailyAlignment: alignment, crops: {},
  };
  for (const [crop, def] of Object.entries(ONSET_BY_CROP)) {
    const a = monsoonOnsetByYear(powerSeries, def);
    const b = monsoonOnsetByYear(chirpsSeries, def);
    const table = compareOnsetSeries(a, b);
    const verdicts = compareShiftVerdicts(a, b);
    const firstDay = dayOfYearFixed365(`2001-${String(def.startMonth).padStart(2, '0')}-01`);
    report.crops[crop] = { definition: def, ...table, verdicts, firstDayShare: { power: firstDayShare(a, firstDay), chirps: firstDayShare(b, firstDay), firstDayOfYear: firstDay } };

    console.log(`\n=== ${slug} / ${crop}: onset day of year (365-day calendar). diff = CHIRPS - POWER ===`);
    if (targets.length === 1) console.table(table.rows.map((r) => ({ year: r.year, POWER: r.a, CHIRPS: r.b, diff: r.diffDays })));
    console.table([table.summary]);
    console.table([{ source: 'POWER', ...verdicts.a }, { source: 'CHIRPS', ...verdicts.b }]);
    overview.push({
      district: slug, crop, bothOnset: table.summary.yearsBothOnset, medianAbsDiff: table.summary.medianAbsDiffDays,
      within7: table.summary.within7DaysShare, r: table.summary.correlation,
      POWER_verdict: verdicts.a.verdict, POWER_shift: verdicts.a.shiftDays, CHIRPS_verdict: verdicts.b.verdict, CHIRPS_shift: verdicts.b.shiftDays,
      POWER_firstDay: report.crops[crop].firstDayShare.power, CHIRPS_firstDay: report.crops[crop].firstDayShare.chirps,
    });
  }
  fs.writeFileSync(path.join(values.chirps, `compare-${slug}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
if (overview.length > 1) { console.log('\n=== overview ==='); console.table(overview); }
if (overview.length === 0) process.exit(1);

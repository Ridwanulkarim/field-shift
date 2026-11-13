// Compares the usable-rain onset dates that two different rainfall sources give for the same district and crop.
// Pure functions: no database, no network. Input is the output of monsoonOnsetByYear() for each source.
//
// This is a DIAGNOSTIC. It does not say which source is right (neither is ground truth); it shows how far the
// advisory's conclusion depends on the choice of source. No agreement threshold is built in: the numbers are
// reported and a person decides whether they are close enough.

import { analyzeOnsetShift } from './onsetAnalysis.js';
import { ONSET_CENSOR_DAY, PLANTING_SPLIT_YEAR } from './rules.js';
import { pearson } from './crosscheck.js';
import { round } from './stats.js';
import { addDays } from './series.js';

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// A year whose earlier windows were partly unobserved cannot be trusted as an onset date (same rule as plantingWindowAnalysis).
const clean = (p) => (p.earlierWindowsUnobserved ? { year: p.year, status: 'unknown', value: null } : p);

// Per-year table plus summary numbers. `a` and `b` are arrays of { year, status, value, earlierWindowsUnobserved }.
// diffDays = b - a (positive: source b says the onset was LATER than source a).
export function compareOnsetSeries(a, b) {
  const bByYear = new Map(b.map((p) => [p.year, clean(p)]));
  const rows = [];
  for (const raw of a) {
    const pa = clean(raw);
    const pb = bByYear.get(pa.year);
    if (!pb) continue;
    const both = pa.status === 'onset' && pb.status === 'onset';
    rows.push({
      year: pa.year,
      a: pa.status === 'onset' ? pa.value : pa.status,
      b: pb.status === 'onset' ? pb.value : pb.status,
      diffDays: both ? pb.value - pa.value : null,
      sameStatus: pa.status === pb.status,
    });
  }
  const diffs = rows.filter((r) => r.diffDays !== null).map((r) => r.diffDays);
  const abs = diffs.map(Math.abs);
  const share = (limit) => (diffs.length ? round(abs.filter((d) => d <= limit).length / diffs.length, 3) : null);
  const r = pearson(rows.filter((x) => x.diffDays !== null).map((x) => x.a), rows.filter((x) => x.diffDays !== null).map((x) => x.b));
  return {
    rows,
    summary: {
      yearsCompared: rows.length,
      yearsBothOnset: diffs.length,
      yearsDifferentStatus: rows.filter((x) => !x.sameStatus).length,
      medianDiffDays: median(diffs),
      medianAbsDiffDays: median(abs),
      meanAbsDiffDays: abs.length ? round(abs.reduce((s, v) => s + v, 0) / abs.length, 2) : null,
      within3DaysShare: share(3),
      within7DaysShare: share(7),
      correlation: r === null ? null : round(r, 3),
    },
  };
}

// The same early-vs-late shift test the advisory uses, run on each source, side by side.
export function compareShiftVerdicts(a, b, { splitYear = PLANTING_SPLIT_YEAR, censorValue = ONSET_CENSOR_DAY } = {}) {
  const run = (series) => analyzeOnsetShift(series.map(clean), { splitYear, censorValue });
  const ra = run(a);
  const rb = run(b);
  const pick = (x) => ({ verdict: x.verdict, shiftDays: x.shiftDays, earlyMedian: x.earlyMedian, lateMedian: x.lateMedian, earlyYears: x.earlyYears, lateYears: x.lateYears, censoredYears: x.censoredYears, pValue: x.test?.pValue ?? null });
  return { a: pick(ra), b: pick(rb), sameVerdict: ra.verdict === rb.verdict };
}

// Share of years whose onset falls on the first day the search allows, per source (the "saturated start" check).
export function firstDayShare(series, firstDayOfYear) {
  const onsets = series.map(clean).filter((p) => p.status === 'onset');
  if (!onsets.length) return null;
  return round(onsets.filter((p) => p.value === firstDayOfYear).length / onsets.length, 3);
}

// Day-alignment check. For each lag L, pairs source a's rainfall on date D with source b's rainfall on date D+L and
// correlates them. If the best lag is not 0, one source's calendar is shifted (a time-zone or date-labelling difference),
// which would blur every onset comparison. lag +1 means b's rain appears one day LATER than a's for the same storm.
// Only days where both values are known are used; n is reported next to each correlation.
export function lagCorrelations(a, b, lags = [-2, -1, 0, 1, 2]) {
  const bByDate = new Map(b.map((r) => [r.date, r.precipMm]));
  const correlations = lags.map((lag) => {
    const xs = [];
    const ys = [];
    for (const row of a) {
      const y = bByDate.get(addDays(row.date, lag));
      if (typeof row.precipMm === 'number' && typeof y === 'number') { xs.push(row.precipMm); ys.push(y); }
    }
    const r = pearson(xs, ys);
    return { lag, r: r === null ? null : round(r, 3), n: xs.length };
  });
  const usable = correlations.filter((c) => c.r !== null);
  const best = usable.length ? usable.reduce((m, c) => (c.r > m.r ? c : m)) : null;
  return { correlations, bestLag: best ? best.lag : null };
}

// The small, farmer-page-safe object the API attaches to an advisory: what the second source concluded, in numbers.
// `crop` is one entry of the report written by scripts/compare-chirps-power.js.
export function crossCheckSummary(report, cropSlug) {
  const c = report?.crops?.[cropSlug];
  if (!c) return null;
  return {
    source: 'CHIRPS via NASA SERVIR ClimateSERV',
    sameVerdict: c.verdicts.sameVerdict,
    powerVerdict: c.verdicts.a.verdict,
    powerShiftDays: c.verdicts.a.shiftDays,
    chirpsVerdict: c.verdicts.b.verdict,
    chirpsShiftDays: c.verdicts.b.shiftDays,
    yearsCompared: c.summary.yearsCompared,
    medianAbsDiffDays: c.summary.medianAbsDiffDays,
    within7DaysShare: c.summary.within7DaysShare,
    correlation: c.summary.correlation,
    firstDayShare: { power: c.firstDayShare.power, chirps: c.firstDayShare.chirps },
    comparedRange: report.comparedRange,
    chirpsRetrievedAt: report.chirpsRetrievedAt,
    chirpsSha256: report.chirpsSha256 ?? null,
  };
}

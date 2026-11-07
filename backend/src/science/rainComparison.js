// Compares two daily rainfall series for the SAME grid cell: NASA POWER (PRECTOTCORR) and GPM IMERG (satellite-based).
// Pure functions: no database, no network. Only days where BOTH series have a real number are compared; a missing day
// is never treated as zero rain.
//
// What this is: a transparent agreement check between two different estimates. What it is not: a validation against
// rain gauges. Agreement does not prove either product correct, disagreement does not say which one is wrong, and the
// two products are not guaranteed to be independent of each other. All thresholds below are heuristics, not validated
// agronomic or statistical standards.

import { indexSeries, isNum } from './series.js';
import { daysInMonth } from './calendar.js';
import { mean, round } from './stats.js';
import { monsoonOnsetByYear } from './climate.js';
import { DRY_DAY_MM, ONSET } from './rules.js';

export const COMPARISON_RULES = Object.freeze({
  minPairedDays: 365,            // less overlap than this and no statistics are reported
  monthMinCoverage: 0.9,         // share of a month's days that must be paired for the month to count
  seasonStartMonth: 6,           // June to September, the monsoon rain total
  seasonEndMonth: 9,
  seasonMinCoverage: 0.98,       // same completeness rule the project uses for rain totals
  minSeasonsForCorrelation: 5,
  minOnsetYears: 5,
  onsetAgreementDays: 7,         // "within a week" is reported as a share, not as a pass/fail
  biasFlagRatio: 0.2,            // total IMERG / total POWER further than +/-20% from 1 raises a flag
  lowCorrelation: 0.8,           // monthly-total correlation below this raises a flag
});

export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pairDays(power, imerg) {
  const ip = indexSeries(power);
  const ii = indexSeries(imerg);
  const paired = [];
  for (const [date, row] of ip) {
    const other = ii.get(date);
    if (other && isNum(row.precipMm) && isNum(other.precipMm)) paired.push({ date, power: row.precipMm, imerg: other.precipMm });
  }
  return paired.sort((a, b) => a.date.localeCompare(b.date));
}

function monthlyAgreement(paired) {
  const groups = new Map();
  for (const p of paired) {
    const key = p.date.slice(0, 7);
    const g = groups.get(key) ?? { power: 0, imerg: 0, days: 0 };
    g.power += p.power;
    g.imerg += p.imerg;
    g.days += 1;
    groups.set(key, g);
  }
  const months = [];
  for (const [key, g] of groups) {
    const dim = daysInMonth(Number(key.slice(0, 4)), Number(key.slice(5, 7)));
    if (g.days >= COMPARISON_RULES.monthMinCoverage * dim) months.push({ month: key, powerMm: g.power, imergMm: g.imerg });
  }
  const r = pearson(months.map((m) => m.powerMm), months.map((m) => m.imergMm));
  return {
    months: months.length,
    correlation: r === null ? null : round(r, 3),
    meanAbsoluteDifferenceMm: months.length ? round(mean(months.map((m) => Math.abs(m.imergMm - m.powerMm))), 1) : null,
  };
}

function seasonalAgreement(paired) {
  const { seasonStartMonth: a, seasonEndMonth: b, seasonMinCoverage } = COMPARISON_RULES;
  const years = new Map();
  for (const p of paired) {
    const month = Number(p.date.slice(5, 7));
    if (month < a || month > b) continue;
    const year = Number(p.date.slice(0, 4));
    const g = years.get(year) ?? { power: 0, imerg: 0, days: 0 };
    g.power += p.power;
    g.imerg += p.imerg;
    g.days += 1;
    years.set(year, g);
  }
  const seasonDays = (year) => { let d = 0; for (let m = a; m <= b; m += 1) d += daysInMonth(year, m); return d; };
  const yearly = [];
  for (const [year, g] of [...years].sort((x, y) => x[0] - y[0])) {
    if (g.days >= seasonMinCoverage * seasonDays(year)) {
      yearly.push({ year, powerMm: round(g.power, 1), imergMm: round(g.imerg, 1), differenceMm: round(g.imerg - g.power, 1) });
    }
  }
  const r = yearly.length >= COMPARISON_RULES.minSeasonsForCorrelation ? pearson(yearly.map((y) => y.powerMm), yearly.map((y) => y.imergMm)) : null;
  const sumP = yearly.reduce((s, y) => s + y.powerMm, 0);
  const sumI = yearly.reduce((s, y) => s + y.imergMm, 0);
  return {
    label: `Rain total, months ${a} to ${b}`,
    years: yearly.length,
    yearly,
    correlation: r === null ? null : round(r, 3),
    imergToPowerRatio: sumP > 0 ? round(sumI / sumP, 3) : null,
  };
}

// Usable-rain onset (same definition as the planting analysis, see rules.js ONSET) computed separately from each series
// restricted to the days both have, so the two onsets are comparable. Only years with a confirmed onset in BOTH count.
function onsetAgreement(paired) {
  const toSeries = (key) => paired.map((p) => ({ date: p.date, precipMm: p[key] }));
  const byYear = (key) => new Map(monsoonOnsetByYear(toSeries(key), ONSET)
    .filter((y) => y.status === 'onset' && !y.earlierWindowsUnobserved).map((y) => [y.year, y.value]));
  const pw = byYear('power');
  const im = byYear('imerg');
  const years = [];
  for (const [year, powerDay] of pw) {
    if (im.has(year)) years.push({ year, powerDayOfYear: powerDay, imergDayOfYear: im.get(year), differenceDays: im.get(year) - powerDay });
  }
  years.sort((x, y) => x.year - y.year);
  const diffs = years.map((y) => y.differenceDays);
  const enough = years.length >= COMPARISON_RULES.minOnsetYears;
  return {
    definition: { ...ONSET, note: 'first start day whose fully observed window total reaches the threshold; day of year on a fixed 365-day calendar' },
    years: years.length,
    yearly: years,
    meanDifferenceDays: enough ? round(mean(diffs), 1) : null,
    medianDifferenceDays: enough ? median(diffs) : null,
    shareWithinDays: enough ? round(diffs.filter((d) => Math.abs(d) <= COMPARISON_RULES.onsetAgreementDays).length / diffs.length, 2) : null,
    withinDays: COMPARISON_RULES.onsetAgreementDays,
    note: 'Positive difference = IMERG onset is later than POWER onset.',
  };
}

export function compareRainfall(powerSeries, imergSeries) {
  const paired = pairDays(powerSeries, imergSeries);
  const base = { pairedDays: paired.length, minPairedDays: COMPARISON_RULES.minPairedDays };
  if (paired.length < COMPARISON_RULES.minPairedDays) {
    return { status: 'insufficient_overlap', ...base, overlap: paired.length ? { firstDate: paired[0].date, lastDate: paired[paired.length - 1].date } : null, flags: ['SHORT_OVERLAP'] };
  }
  const sumP = paired.reduce((s, p) => s + p.power, 0);
  const sumI = paired.reduce((s, p) => s + p.imerg, 0);
  const wetP = (p) => p.power >= DRY_DAY_MM;
  const wetI = (p) => p.imerg >= DRY_DAY_MM;
  const agree = paired.filter((p) => wetP(p) === wetI(p)).length;
  const r = pearson(paired.map((p) => p.power), paired.map((p) => p.imerg));
  const ratio = sumP > 0 ? sumI / sumP : null;
  const monthly = monthlyAgreement(paired);
  const flags = [];
  if (ratio !== null && Math.abs(ratio - 1) > COMPARISON_RULES.biasFlagRatio) flags.push(ratio > 1 ? 'IMERG_WETTER_THAN_POWER' : 'IMERG_DRIER_THAN_POWER');
  if (monthly.correlation !== null && monthly.correlation < COMPARISON_RULES.lowCorrelation) flags.push('LOW_MONTHLY_CORRELATION');
  return {
    status: 'ok',
    ...base,
    overlap: { firstDate: paired[0].date, lastDate: paired[paired.length - 1].date },
    daily: {
      meanPowerMmPerDay: round(sumP / paired.length, 3),
      meanImergMmPerDay: round(sumI / paired.length, 3),
      biasMmPerDay: round((sumI - sumP) / paired.length, 3),
      imergToPowerRatio: ratio === null ? null : round(ratio, 3),
      correlation: r === null ? null : round(r, 3),
      wetDayThresholdMm: DRY_DAY_MM,
      wetDryAgreementShare: round(agree / paired.length, 3),
    },
    monthly,
    season: seasonalAgreement(paired),
    onset: onsetAgreement(paired),
    flags,
    thresholds: { ...COMPARISON_RULES, note: 'Heuristic thresholds for the flags only; not validated standards.' },
  };
}

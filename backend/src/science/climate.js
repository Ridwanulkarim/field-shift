// Climate indicators computed from DAILY series.
//
// A series is an array of { date: 'YYYY-MM-DD', precipMm, tMaxC, tMinC } in date order.
// A missing observation is null. Nothing here fills gaps: a window or year is used only
// when enough of its days have data (MIN_COVERAGE), otherwise that year is left out.

import { cycleYearOf, expectedDaysInCycle } from './calendar.js';
import { trendSummary, mean, round } from './stats.js';
import {
  MIN_COVERAGE,
  RAIN_TOTAL_MIN_COVERAGE,
  DRY_SPELL_MAX_UNCERTAINTY_DAYS,
  ONSET,
  DRY_DAY_MM,
  PREMONSOON_HEAT_C,
} from './rules.js';
import { isNum, indexSeries, valueOn, cycleDates, windowSum, dayOfYearFixed365, daysBetween } from './series.js';

// Group rows by the cycle (starting year) they belong to for a month window.
function groupByCycle(series, startMonth, endMonth) {
  const groups = new Map();
  for (const row of series) {
    const year = Number(row.date.slice(0, 4));
    const month = Number(row.date.slice(5, 7));
    const cy = cycleYearOf(year, month, startMonth, endMonth);
    if (cy === null) continue;
    if (!groups.has(cy)) groups.set(cy, []);
    groups.get(cy).push(row);
  }
  return groups;
}

function coverageOk(rows, field, cy, startMonth, endMonth) {
  const expected = expectedDaysInCycle(cy, startMonth, endMonth);
  const valid = rows.filter((r) => isNum(r[field])).length;
  return valid >= MIN_COVERAGE * expected;
}

// Total rainfall (mm) per cycle year for a month window.
// A year is reported only if at least RAIN_TOTAL_MIN_COVERAGE of its calendar days were
// observed. `observedDays` and `expectedDays` are returned so the shortfall is visible.
export function yearlyRainTotal(series, startMonth, endMonth) {
  const out = [];
  for (const [cy, rows] of groupByCycle(series, startMonth, endMonth)) {
    const expectedDays = expectedDaysInCycle(cy, startMonth, endMonth);
    const valid = rows.filter((r) => isNum(r.precipMm));
    if (valid.length < RAIN_TOTAL_MIN_COVERAGE * expectedDays) continue;
    out.push({ year: cy, value: valid.reduce((s, r) => s + r.precipMm, 0), observedDays: valid.length, expectedDays });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Share of days (0-1) with daily maximum >= thresholdC, per cycle year.
export function yearlyHeatFraction(series, startMonth, endMonth, thresholdC) {
  const out = [];
  for (const [cy, rows] of groupByCycle(series, startMonth, endMonth)) {
    if (!coverageOk(rows, 'tMaxC', cy, startMonth, endMonth)) continue;
    const valid = rows.filter((r) => isNum(r.tMaxC));
    const hot = valid.filter((r) => r.tMaxC >= thresholdC).length;
    out.push({ year: cy, value: hot / valid.length });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Number of days with daily maximum >= thresholdC, per cycle year (counts on valid days).
export function yearlyHeatDays(series, startMonth, endMonth, thresholdC) {
  const out = [];
  for (const [cy, rows] of groupByCycle(series, startMonth, endMonth)) {
    if (!coverageOk(rows, 'tMaxC', cy, startMonth, endMonth)) continue;
    out.push({ year: cy, value: rows.filter((r) => isNum(r.tMaxC) && r.tMaxC >= thresholdC).length });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Longest run of consecutive dry days per cycle year, walking REAL calendar dates.
// Each day is dry (< dryMm), wet (>= dryMm) or unknown (date absent or value null).
//   value          = longest run that is certainly dry (unknown days break the run): a lower bound
//   longestPossible = longest run if every unknown day were dry: an upper bound
//   unknownDays    = days in the cycle that are unknown
// A year is dropped when the two bounds differ by more than DRY_SPELL_MAX_UNCERTAINTY_DAYS.
export function yearlyLongestDrySpell(series, startMonth, endMonth, dryMm = DRY_DAY_MM) {
  const index = indexSeries(series);
  const years = new Set();
  for (const row of series) {
    const cy = cycleYearOf(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)), startMonth, endMonth);
    if (cy !== null) years.add(cy);
  }
  const out = [];
  for (const cy of years) {
    const dates = cycleDates(cy, startMonth, endMonth);
    let known = 0;
    let knownRun = 0;
    let possible = 0;
    let possibleRun = 0;
    let unknownDays = 0;
    for (const date of dates) {
      const v = valueOn(index, date, 'precipMm');
      if (v === null) {
        unknownDays += 1;
        knownRun = 0;
        possibleRun += 1;
      } else if (v < dryMm) {
        knownRun += 1;
        possibleRun += 1;
      } else {
        knownRun = 0;
        possibleRun = 0;
      }
      if (knownRun > known) known = knownRun;
      if (possibleRun > possible) possible = possibleRun;
    }
    if ((dates.length - unknownDays) < MIN_COVERAGE * dates.length) continue;
    if (possible - known > DRY_SPELL_MAX_UNCERTAINTY_DAYS) continue;
    out.push({ year: cy, value: known, longestPossible: possible, unknownDays });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Usable-rain onset per year, with an explicit status for every year that has data:
//   onset      first calendar start date whose fully observed `windowDays`-day total >= thresholdMm
//   no_onset   every window was fully observed and none qualified
//   unknown    an earlier onset cannot be ruled out because windows before the first qualifying
//              one (or all windows, if none qualified) were not fully observed
// `value` is the day of year on a fixed 365-day calendar (see series.js), so leap years do not
// shift the answer by a day.
export function monsoonOnsetByYear(series, params = ONSET) {
  const { startMonth, endMonth, windowDays, thresholdMm } = params;
  const index = indexSeries(series);
  const years = new Set();
  for (const row of series) {
    const cy = cycleYearOf(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)), startMonth, endMonth);
    if (cy !== null) years.add(cy);
  }
  const out = [];
  for (const year of years) {
    const dates = cycleDates(year, startMonth, endMonth);
    const lastStart = dates.length - windowDays;
    let status = 'no_onset';
    let value = null;
    let sawUnobserved = false;
    for (let i = 0; i <= lastStart; i += 1) {
      const w = windowSum(index, dates[i], windowDays, 'precipMm', windowDays);
      if (w.sum === null) {
        sawUnobserved = true;
        continue;
      }
      if (w.sum >= thresholdMm) {
        status = 'onset';
        value = dayOfYearFixed365(dates[i]);
        break;
      }
    }
    if (status === 'no_onset' && sawUnobserved) status = 'unknown';
    // An 'onset' that comes after unobserved windows is still a valid, observed onset date,
    // but an EARLIER onset might have happened inside the gap: flag it.
    out.push({ year, status, value, earlierWindowsUnobserved: status === 'onset' && sawUnobserved });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Day of year of the first "usable rain" onset (see rules.js ONSET), per year.
// Only years with a confirmed onset are returned. Use monsoonOnsetByYear for no_onset / unknown years.
// Years whose earlier windows were partly unobserved are excluded: a possible earlier onset
// inside the gap cannot be ruled out, so the date would be biased late.
export function yearlyMonsoonOnset(series, params = ONSET) {
  return monsoonOnsetByYear(series, params)
    .filter((p) => p.status === 'onset' && !p.earlierWindowsUnobserved)
    .map((p) => ({ year: p.year, value: p.value }));
}

// Describes the data coverage of a series, for provenance and honesty in the UI.
// `absentDays` counts calendar dates between the first and last row that have no row at all
// (distinct from a row whose value is null, which is counted in `missing`).
export function seriesCoverage(series) {
  const missing = { precipMm: 0, tMaxC: 0, tMinC: 0 };
  if (series.length === 0) return { days: 0, firstDate: null, lastDate: null, expectedDays: 0, absentDays: 0, missing };
  for (const r of series) {
    for (const k of Object.keys(missing)) if (!isNum(r[k])) missing[k] += 1;
  }
  const firstDate = series[0].date;
  const lastDate = series[series.length - 1].date;
  const expectedDays = daysBetween(firstDate, lastDate) + 1;
  return { days: series.length, firstDate, lastDate, expectedDays, absentDays: Math.max(0, expectedDays - series.length), missing };
}

// Climate indicators shown to the user, each with a yearly series and a trend summary.
export function climateIndicators(series) {
  const defs = [
    {
      id: 'monsoonRain',
      label: 'Monsoon rainfall (Jun-Sep)',
      unit: 'mm',
      definition: 'Sum of daily corrected precipitation from 1 June to 30 September. Years with under 98% of days observed are left out.',
      yearly: yearlyRainTotal(series, 6, 9),
    },
    {
      id: 'rabiRain',
      label: 'Dry-season rainfall (Nov-Mar)',
      unit: 'mm',
      definition: 'Sum of daily corrected precipitation from 1 November to 31 March (year = November year). Years with under 98% of days observed are left out.',
      yearly: yearlyRainTotal(series, 11, 3),
    },
    {
      id: 'monsoonOnset',
      label: 'Usable-rain onset',
      unit: 'day of year',
      definition: `First day on/after 1 May whose ${ONSET.windowDays} consecutive calendar days, all observed, total at least ${ONSET.thresholdMm} mm (heuristic definition). Years without an onset or with unobserved earlier windows are listed in yearStatus, not guessed.`,
      yearly: yearlyMonsoonOnset(series),
      yearStatus: monsoonOnsetByYear(series).map((p) => ({ year: p.year, status: p.earlierWindowsUnobserved ? 'onset_but_earlier_windows_unobserved' : p.status })),
    },
    {
      id: 'preMonsoonHeatDays',
      label: `Hot days in Mar-May (max temp >= ${PREMONSOON_HEAT_C} C)`,
      unit: 'days',
      definition: `Count of days from March to May with daily maximum temperature at or above ${PREMONSOON_HEAT_C} C.`,
      yearly: yearlyHeatDays(series, 3, 5, PREMONSOON_HEAT_C),
    },
    {
      id: 'rabiDrySpell',
      label: 'Longest dry spell in Nov-Mar',
      unit: 'days',
      definition: `Longest run of consecutive calendar days certainly below ${DRY_DAY_MM} mm rain, November to March. Missing days break the run (lower bound); longestPossible counts them as dry (upper bound). Years where the two differ by more than ${DRY_SPELL_MAX_UNCERTAINTY_DAYS} days are left out.`,
      yearly: yearlyLongestDrySpell(series, 11, 3),
    },
  ];
  // Extra per-year fields (observedDays, longestPossible, ...) pass through so uncertainty is visible.
  return defs.map((d) => ({ ...d, yearly: d.yearly.map((p) => ({ ...p, value: round(p.value, 2) })), trend: trendSummary(d.yearly) }));
}

// Average rainfall and heat exposure during one crop's months, over the years with enough data.
export function cropClimate(series, crop) {
  const rain = yearlyRainTotal(series, crop.startMonth, crop.endMonth);
  const heat = yearlyHeatFraction(series, crop.startMonth, crop.endMonth, crop.heatThresholdC);
  return {
    rainMm: rain.length ? round(mean(rain.map((p) => p.value)), 1) : null,
    rainYears: rain.length,
    heatFraction: heat.length ? round(mean(heat.map((p) => p.value)), 4) : null,
    heatYears: heat.length,
  };
}

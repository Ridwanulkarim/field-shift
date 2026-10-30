// Climate indicators computed from DAILY series.
//
// A series is an array of { date: 'YYYY-MM-DD', precipMm, tMaxC, tMinC } in date order.
// A missing observation is null. Nothing here fills gaps: a window or year is used only
// when enough of its days have data (MIN_COVERAGE), otherwise that year is left out.

import { cycleYearOf, expectedDaysInCycle, dayOfYear } from './calendar.js';
import { trendSummary, mean, round } from './stats.js';
import { MIN_COVERAGE, ONSET, DRY_DAY_MM, PREMONSOON_HEAT_C } from './rules.js';

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

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
export function yearlyRainTotal(series, startMonth, endMonth) {
  const out = [];
  for (const [cy, rows] of groupByCycle(series, startMonth, endMonth)) {
    if (!coverageOk(rows, 'precipMm', cy, startMonth, endMonth)) continue;
    out.push({ year: cy, value: rows.reduce((s, r) => s + (isNum(r.precipMm) ? r.precipMm : 0), 0) });
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

// Longest run of consecutive dry days per cycle year. A missing day breaks a run.
export function yearlyLongestDrySpell(series, startMonth, endMonth, dryMm = DRY_DAY_MM) {
  const out = [];
  for (const [cy, rows] of groupByCycle(series, startMonth, endMonth)) {
    if (!coverageOk(rows, 'precipMm', cy, startMonth, endMonth)) continue;
    let best = 0;
    let run = 0;
    for (const r of rows) {
      if (isNum(r.precipMm) && r.precipMm < dryMm) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    out.push({ year: cy, value: best });
  }
  return out.sort((a, b) => a.year - b.year);
}

// Day of year of the first "usable rain" onset (see rules.js ONSET), per year.
export function yearlyMonsoonOnset(series, params = ONSET) {
  const { startMonth, endMonth, windowDays, thresholdMm } = params;
  const out = [];
  for (const [year, rows] of groupByCycle(series, startMonth, endMonth)) {
    if (!coverageOk(rows, 'precipMm', year, startMonth, endMonth)) continue;
    for (let i = 0; i + windowDays <= rows.length; i += 1) {
      const win = rows.slice(i, i + windowDays);
      if (!win.every((r) => isNum(r.precipMm))) continue;
      if (win.reduce((s, r) => s + r.precipMm, 0) >= thresholdMm) {
        out.push({ year, value: dayOfYear(rows[i].date) });
        break;
      }
    }
  }
  return out.sort((a, b) => a.year - b.year);
}

// Describes the data coverage of a series, for provenance and honesty in the UI.
export function seriesCoverage(series) {
  if (series.length === 0) return { days: 0, firstDate: null, lastDate: null, missing: { precipMm: 0, tMaxC: 0, tMinC: 0 } };
  const missing = { precipMm: 0, tMaxC: 0, tMinC: 0 };
  for (const r of series) {
    for (const k of Object.keys(missing)) if (!isNum(r[k])) missing[k] += 1;
  }
  return { days: series.length, firstDate: series[0].date, lastDate: series[series.length - 1].date, missing };
}

// Climate indicators shown to the user, each with a yearly series and a trend summary.
export function climateIndicators(series) {
  const defs = [
    {
      id: 'monsoonRain',
      label: 'Monsoon rainfall (Jun-Sep)',
      unit: 'mm',
      definition: 'Sum of daily corrected precipitation from 1 June to 30 September.',
      yearly: yearlyRainTotal(series, 6, 9),
    },
    {
      id: 'rabiRain',
      label: 'Dry-season rainfall (Nov-Mar)',
      unit: 'mm',
      definition: 'Sum of daily corrected precipitation from 1 November to 31 March (year = November year).',
      yearly: yearlyRainTotal(series, 11, 3),
    },
    {
      id: 'monsoonOnset',
      label: 'Usable-rain onset',
      unit: 'day of year',
      definition: `First day on/after 1 May whose ${ONSET.windowDays}-day rainfall total is at least ${ONSET.thresholdMm} mm (heuristic definition).`,
      yearly: yearlyMonsoonOnset(series),
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
      definition: `Longest run of consecutive days with less than ${DRY_DAY_MM} mm rain, November to March.`,
      yearly: yearlyLongestDrySpell(series, 11, 3),
    },
  ];
  return defs.map((d) => ({ ...d, yearly: d.yearly.map((p) => ({ year: p.year, value: round(p.value, 2) })), trend: trendSummary(d.yearly) }));
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

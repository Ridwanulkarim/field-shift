// Field intelligence, version 1: EVIDENCE, not a score.
// Pure functions over a daily climate series ({ date, precipMm, tMaxC, tMinC }, null = missing).
//
// Two things are computed:
//   1. A monthly climatology of the grid cell: for each calendar month, the rainfall total and the mean
//      temperatures over the years that have enough observed days. A month with too many missing days in a
//      given year is left out of that year, never filled and never counted as zero. A partial current
//      month therefore drops out by itself.
//   2. For each crop, how the cell's rainfall and heat during the crop's months relate to the crop's
//      (UNVERIFIED) water need and heat threshold, and whether the farmer-entered soil salinity exceeds the
//      crop's (UNVERIFIED) tolerance. Nothing is ranked or combined into one number.

import { cropClimate } from './climate.js';
import { daysInMonth } from './calendar.js';
import { isNum } from './series.js';
import { mean, round } from './stats.js';
import { MIN_COVERAGE, RAIN_TOTAL_MIN_COVERAGE } from './rules.js';
import { salinityCompatibility } from './soil.js';

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function monthlyClimatology(series) {
  const groups = new Map(); // 'YYYY-MM' -> rows
  for (const row of series) {
    const key = row.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const perMonth = Array.from({ length: 12 }, () => ({ rain: [], tMax: [], tMin: [] }));
  for (const [key, rows] of groups) {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const expected = daysInMonth(year, month);
    const valid = (field) => rows.filter((r) => isNum(r[field])).map((r) => r[field]);
    const rain = valid('precipMm');
    if (rain.length >= RAIN_TOTAL_MIN_COVERAGE * expected) perMonth[month - 1].rain.push(rain.reduce((a, b) => a + b, 0));
    const tMax = valid('tMaxC');
    if (tMax.length >= MIN_COVERAGE * expected) perMonth[month - 1].tMax.push(mean(tMax));
    const tMin = valid('tMinC');
    if (tMin.length >= MIN_COVERAGE * expected) perMonth[month - 1].tMin.push(mean(tMin));
  }
  return perMonth.map((m, i) => ({
    month: i + 1,
    rainMm: { mean: m.rain.length ? round(mean(m.rain), 1) : null, median: m.rain.length ? round(median(m.rain), 1) : null, years: m.rain.length },
    tMaxC: { mean: m.tMax.length ? round(mean(m.tMax), 1) : null, years: m.tMax.length },
    tMinC: { mean: m.tMin.length ? round(mean(m.tMin), 1) : null, years: m.tMin.length },
  }));
}

// Evidence for one crop at one field. `soil.salinityClass` may be null (not entered).
export function cropFieldEvidence(series, crop, soil) {
  const c = cropClimate(series, crop);
  const need = { min: crop.waterNeedMmMin, max: crop.waterNeedMmMax };
  const rain = c.rainMm;
  const flags = [];
  const compat = salinityCompatibility(soil?.salinityClass ?? null, crop);
  if (compat === 'exceeds_tolerance') flags.push('salinity_exceeds_tolerance');
  if (compat === 'unknown') flags.push('salinity_not_entered');
  if (rain === null) flags.push('rain_data_insufficient');
  if (c.heatFraction === null) flags.push('heat_data_insufficient');
  return {
    slug: crop.slug,
    nameEn: crop.nameEn,
    nameBn: crop.nameBn,
    season: { startMonth: crop.startMonth, endMonth: crop.endMonth },
    traitBasis: crop.basis ?? 'UNVERIFIED_GENERAL_KNOWLEDGE',
    seasonRain: {
      meanMm: rain,
      years: c.rainYears,
      waterNeedMm: need,
      // Arithmetic only: rain in the crop's months minus the (unverified) seasonal need, floored at 0.
      // It ignores soil moisture storage, runoff and timing, so it is not an irrigation requirement.
      shortfallMm: rain === null ? null : { atMinNeed: round(Math.max(0, need.min - rain), 1), atMaxNeed: round(Math.max(0, need.max - rain), 1) },
    },
    heat: {
      thresholdC: crop.heatThresholdC,
      meanShareOfDaysAtOrAbove: c.heatFraction,
      years: c.heatYears,
    },
    salinity: {
      fieldClass: soil?.salinityClass ?? null,
      cropTolerance: crop.salinityTolerance,
      compatibility: compat,
    },
    flags,
  };
}

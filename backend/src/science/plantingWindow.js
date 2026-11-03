// Planting-window analysis for one crop in one district. Pure functions: no database, no HTTP,
// no clock. Input is a daily climate series ({ date, precipMm, tMaxC, tMinC }) plus a crop row.
//
// It answers three questions with numbers computed from the series, never typed in:
//   1. Has the "usable rain" onset moved between an early and a late period?
//   2. Has the heat accumulated over the crop's season (growing degree days) moved?
//   3. Is the onset result strong enough to recommend shifting planting, and by how many days?

import { monsoonOnsetByYear } from './climate.js';
import { analyzeOnsetShift } from './onsetAnalysis.js';
import { indexSeries, cycleDates, valueOn } from './series.js';
import { cycleYearOf } from './calendar.js';
import { round } from './stats.js';
import { onsetSensitivity, DEFAULT_GRID } from './onsetSensitivity.js';
import {
  GDD,
  GDD_MIN_COVERAGE,
  ONSET_BY_CROP,
  ONSET_CENSOR_DAY,
  PLANTING_SPLIT_YEAR,
  SHIFT_ROBUST_SHARE,
} from './rules.js';

// Growing degree days for one day, or null when either temperature is unknown.
export function dailyGdd(tMaxC, tMinC, { baseC = GDD.baseC, capC = GDD.capC } = {}) {
  if (typeof tMaxC !== 'number' || !Number.isFinite(tMaxC)) return null;
  if (typeof tMinC !== 'number' || !Number.isFinite(tMinC)) return null;
  const max = Math.min(tMaxC, capC);
  const min = Math.max(tMinC, baseC);
  return Math.max(0, (max + min) / 2 - baseC);
}

// GDD accumulated over the crop's calendar window, per cycle year.
// Returns [{ year, status: 'ok', value } | { year, status: 'unknown', coverage }].
// A year with too many unobserved days is 'unknown', never a smaller total.
export function yearlyGdd(series, startMonth, endMonth, params = GDD) {
  const index = indexSeries(series);
  const years = new Set();
  for (const row of series) {
    const cy = cycleYearOf(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)), startMonth, endMonth);
    if (cy !== null) years.add(cy);
  }
  const out = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    const dates = cycleDates(year, startMonth, endMonth);
    let total = 0;
    let observed = 0;
    for (const date of dates) {
      const g = dailyGdd(valueOn(index, date, 'tMaxC'), valueOn(index, date, 'tMinC'), params);
      if (g !== null) {
        total += g;
        observed += 1;
      }
    }
    const coverage = observed / dates.length;
    out.push(coverage >= GDD_MIN_COVERAGE
      ? { year, status: 'ok', value: round(total, 1) }
      : { year, status: 'unknown', coverage: round(coverage, 3) });
  }
  return out;
}

// The onset definition that applies to a crop, or null when onset is not relevant to it
// (for example irrigated Boro, which does not wait for the rains).
export function onsetDefinitionFor(crop) {
  return ONSET_BY_CROP[crop.slug] ?? null;
}

export function onsetApplies(crop) {
  return onsetDefinitionFor(crop) !== null;
}

// How many alternative onset definitions agree with the main verdict?
// Only thresholds and window lengths are varied, and the crop's own season start is kept: a
// definition that starts at a different time of year answers a different question for that crop.
function sensitivitySummary(series, definition, splitYear, mainVerdict) {
  const grid = { ...DEFAULT_GRID, startMonths: [definition.startMonth] };
  const rows = onsetSensitivity(series, { grid, splitYear, endMonth: definition.endMonth });
  const usable = rows.filter((r) => r.verdict !== 'insufficient_data');
  const agreeing = usable.filter((r) => r.verdict === mainVerdict).length;
  return {
    definitionsTried: rows.length,
    definitionsUsable: usable.length,
    definitionsAgreeing: agreeing,
    agreeingShare: usable.length ? round(agreeing / usable.length, 3) : null,
    shiftDaysRange: usable.length
      ? [Math.min(...usable.map((r) => r.shiftDays)), Math.max(...usable.map((r) => r.shiftDays))]
      : null,
  };
}

// The decision rule, kept separate so it can be tested on its own.
// Returns { action, shiftDays, confidence, reason }.
export function decideShift({ applies, verdict, shiftDays, agreeingShare }) {
  if (!applies) return { action: 'none', shiftDays: null, confidence: 'not_applicable', reason: 'onset_not_applicable' };
  if (verdict === 'insufficient_data') return { action: 'none', shiftDays: null, confidence: 'none', reason: 'insufficient_data' };
  if (verdict === 'no_distinguishable_shift') return { action: 'none', shiftDays: 0, confidence: 'none', reason: 'no_distinguishable_shift' };
  if (agreeingShare === null || agreeingShare < SHIFT_ROBUST_SHARE) {
    return { action: 'none', shiftDays: null, confidence: 'weak', reason: 'sensitive_to_definition' };
  }
  return {
    action: verdict === 'later_onset' ? 'delay' : 'advance',
    shiftDays: Math.round(Math.abs(shiftDays)),
    confidence: 'supported',
    reason: verdict,
  };
}

export const PLANTING_LIMITATIONS = [
  'Onset is a heuristic definition: the first 7-day rainfall total of at least 50 mm on or after the crop\'s season-start date (1 May for Aus, 1 June for Aman), not an official monsoon index. The start dates are unverified agronomic assumptions.',
  'Rainfall is a NASA POWER grid-cell value (about 0.5 degrees) from a single modelled source, not a measurement on the field, and it has not been checked against an independent dataset.',
  'A shift between two periods of a short series is an indication, not proof of climate change; natural variability can produce it.',
  'The recommendation is a number of days to move planting. It does not state exact dates, and rainfall alone does not decide the right planting date.',
  'Growing degree day parameters (10 C base, 35 C cap) are unverified general values, not variety-specific.',
];

export function plantingWindowAnalysis(series, crop, { splitYear = PLANTING_SPLIT_YEAR } = {}) {
  const definition = onsetDefinitionFor(crop);
  const applies = definition !== null;

  let onset = { applies: false, definition: null, yearly: [], analysis: null, sensitivity: null };
  if (applies) {
    const byYear = monsoonOnsetByYear(series, definition);
    const yearly = byYear.map((p) => (p.earlierWindowsUnobserved ? { year: p.year, status: 'unknown' } : p));
    const analysis = analyzeOnsetShift(yearly, { splitYear, censorValue: ONSET_CENSOR_DAY });
    onset = {
      applies: true,
      definition,
      yearly: byYear.map(({ year, status, value, earlierWindowsUnobserved }) => ({ year, status, value, earlierWindowsUnobserved })),
      analysis,
      sensitivity: sensitivitySummary(series, definition, splitYear, analysis.verdict),
    };
  }

  const gddYearly = yearlyGdd(series, crop.startMonth, crop.endMonth);
  const gddAnalysis = analyzeOnsetShift(gddYearly, { splitYear });
  // analyzeOnsetShift is generic over { year, value }; for GDD the "shift" is in degree days, not days.
  const { shiftDays: gddShift, verdict: gddVerdict, ...gddRest } = gddAnalysis;
  const gddVerdictNames = {
    later_onset: 'higher_gdd',
    earlier_onset: 'lower_gdd',
    no_distinguishable_shift: 'no_distinguishable_shift',
    insufficient_data: 'insufficient_data',
  };

  const decision = decideShift({
    applies,
    verdict: onset.analysis?.verdict ?? null,
    shiftDays: onset.analysis?.shiftDays ?? null,
    agreeingShare: onset.sensitivity?.agreeingShare ?? null,
  });

  return {
    crop: { slug: crop.slug, startMonth: crop.startMonth, endMonth: crop.endMonth },
    onset,
    gdd: {
      parameters: GDD,
      yearly: gddYearly,
      analysis: { ...gddRest, shiftGdd: gddShift, verdict: gddVerdictNames[gddVerdict] },
    },
    recommendation: decision,
    limitations: PLANTING_LIMITATIONS,
  };
}
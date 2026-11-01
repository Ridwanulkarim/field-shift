// How much does the onset-shift verdict depend on our own definition choices?
// Pure function: no database, no clock. Runs the same comparison for a grid of definitions.

import { monsoonOnsetByYear } from './climate.js';
import { analyzeOnsetShift } from './onsetAnalysis.js';

export const DEFAULT_GRID = {
  thresholdsMm: [30, 40, 50, 60, 75],
  windowDays: [5, 7, 10],
  startMonths: [5, 6], // 1 May (includes pre-monsoon storms) or 1 June
};

// Returns one row per definition. `splitYear` should be fixed in advance, not chosen after looking.
export function onsetSensitivity(series, { grid = DEFAULT_GRID, splitYear = null, endMonth = 8 } = {}) {
  const rows = [];
  for (const startMonth of grid.startMonths) {
    for (const windowDays of grid.windowDays) {
      for (const thresholdMm of grid.thresholdsMm) {
        const byYear = monsoonOnsetByYear(series, { startMonth, endMonth, windowDays, thresholdMm });
        const yearly = byYear.map((p) => (p.earlierWindowsUnobserved ? { year: p.year, status: 'unknown' } : p));
        const r = analyzeOnsetShift(yearly, { splitYear });
        rows.push({
          startMonth, windowDays, thresholdMm,
          earlyMedian: r.earlyMedian, lateMedian: r.lateMedian, shiftDays: r.shiftDays,
          pValue: r.test ? r.test.pValue : null, verdict: r.verdict,
          censoredYears: r.censoredYears, excludedYears: r.excludedYears,
        });
      }
    }
  }
  return rows;
}

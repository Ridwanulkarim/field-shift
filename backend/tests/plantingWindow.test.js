// Unit tests for the planting-window analysis.
// Every series here is a HAND-BUILT FIXTURE with a known answer. None of it is NASA data.

import { describe, it, expect } from 'vitest';
import { buildSeries, isoDate } from './helpers/series.js';
import {
  dailyGdd,
  yearlyGdd,
  onsetApplies,
  onsetDefinitionFor,
  decideShift,
  boundaryReport,
  plantingWindowAnalysis,
} from '../src/science/plantingWindow.js';

const AMAN = { slug: 'aman', startMonth: 7, endMonth: 11 };
const BORO = { slug: 'boro', startMonth: 12, endMonth: 5 };
const AUS = { slug: 'aus', startMonth: 4, endMonth: 7 };

const dayOfYearUtc = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);

// Rain starts on `rainStart(year)` (a Date.UTC-style [month, day]) and then falls 10 mm every day.
// A 7-day window that already holds 5 rainy days reaches 50 mm, so the detected onset is 2 days
// before the first rainy day. Only DIFFERENCES between periods are asserted below.
function seriesWithOnset({ early, late, lateTmax = 32, splitYear = 2013 }) {
  return buildSeries(2001, 2025, (y, m, d) => {
    const [sm, sd] = y < splitYear ? early(y) : late(y);
    const rain = m > sm || (m === sm && d >= sd) ? 10 : 0;
    return { precipMm: m <= 8 ? rain : 0, tMaxC: y < splitYear ? 32 : lateTmax, tMinC: 22 };
  });
}

describe('dailyGdd', () => {
  it('computes the modified-method value for a normal day', () => {
    expect(dailyGdd(32, 22)).toBe(17); // (32 + 22) / 2 - 10
  });
  it('caps the maximum at 35 C', () => {
    expect(dailyGdd(41, 25)).toBe(20); // (35 + 25) / 2 - 10
  });
  it('raises a minimum below 10 C to 10 C, and never goes below zero', () => {
    expect(dailyGdd(14, 2)).toBe(2); // (14 + 10) / 2 - 10
    expect(dailyGdd(8, 3)).toBe(0);
  });
  it('is null when either temperature is unknown', () => {
    expect(dailyGdd(null, 20)).toBeNull();
    expect(dailyGdd(30, undefined)).toBeNull();
    expect(dailyGdd(NaN, 20)).toBeNull();
  });
});

describe('yearlyGdd', () => {
  it('sums the crop window for every cycle year', () => {
    const series = buildSeries(2001, 2003, () => ({ precipMm: 0, tMaxC: 32, tMinC: 22 }));
    const result = yearlyGdd(series, 7, 11); // 153 days x 17
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ year: 2001, status: 'ok', value: 153 * 17 });
  });
  it('marks a year unknown instead of reporting a smaller total when too many days are missing', () => {
    const series = buildSeries(2001, 2001, (y, m) => ({ precipMm: 0, tMaxC: m === 8 ? null : 32, tMinC: 22 }));
    const [row] = yearlyGdd(series, 7, 11); // August (31 of 153 days) has no maximum temperature
    expect(row.status).toBe('unknown');
    expect(row.value).toBeUndefined();
    expect(row.coverage).toBeLessThan(0.98);
  });
  it('tolerates one missing day (coverage stays above 98 percent)', () => {
    const series = buildSeries(2001, 2001, (y, m, d) => ({ precipMm: 0, tMaxC: m === 8 && d === 1 ? null : 32, tMinC: 22 }));
    expect(yearlyGdd(series, 7, 11)[0].status).toBe('ok');
  });
  it('handles a window that wraps past December (Boro)', () => {
    const series = buildSeries(2001, 2003, () => ({ precipMm: 0, tMaxC: 32, tMinC: 22 }));
    const result = yearlyGdd(series, 12, 5);
    expect(result.map((r) => r.year)).toEqual([2000, 2001, 2002, 2003]);
    expect(result.find((r) => r.year === 2001).status).toBe('ok'); // Dec 2001 - May 2002
    expect(result.find((r) => r.year === 2000).status).toBe('unknown'); // only Jan-May 2001 exists
  });
});

describe('onsetApplies', () => {
  it('is true for rain-fed Aus and Aman and false for irrigated Boro and for crops without a definition', () => {
    expect(onsetApplies(AMAN)).toBe(true);
    expect(onsetApplies(AUS)).toBe(true);
    expect(onsetApplies(BORO)).toBe(false);
    expect(onsetApplies({ slug: 'wheat', startMonth: 11, endMonth: 3 })).toBe(false);
  });
  it('uses a May start for Aus and a June start for Aman', () => {
    expect(onsetDefinitionFor(AUS).startMonth).toBe(5);
    expect(onsetDefinitionFor(AMAN).startMonth).toBe(6);
  });
});

describe('decideShift', () => {
  const base = { applies: true, verdict: 'later_onset', shiftDays: 11.4, agreeingShare: 0.8 };
  it('recommends delaying by the rounded shift when the result is robust', () => {
    expect(decideShift(base)).toEqual({ action: 'delay', shiftDays: 11, confidence: 'supported', reason: 'later_onset' });
  });
  it('recommends advancing for an earlier onset and reports a positive number of days', () => {
    expect(decideShift({ ...base, verdict: 'earlier_onset', shiftDays: -6.6 })).toMatchObject({ action: 'advance', shiftDays: 7 });
  });
  it('gives no recommendation when the result depends on the onset definition', () => {
    expect(decideShift({ ...base, agreeingShare: 0.59 })).toMatchObject({ action: 'none', shiftDays: null, confidence: 'weak' });
  });
  it('treats exactly the robust share as robust', () => {
    expect(decideShift({ ...base, agreeingShare: 0.6 }).action).toBe('delay');
  });
  it('gives no recommendation when no shift is distinguishable, and says shift = 0', () => {
    expect(decideShift({ ...base, verdict: 'no_distinguishable_shift', shiftDays: 2 })).toMatchObject({ action: 'none', shiftDays: 0 });
  });
  it('gives no recommendation for insufficient data', () => {
    expect(decideShift({ ...base, verdict: 'insufficient_data', shiftDays: null })).toMatchObject({ action: 'none', reason: 'insufficient_data' });
  });
  it('does not apply to irrigated dry-season crops', () => {
    expect(decideShift({ ...base, applies: false })).toMatchObject({ confidence: 'not_applicable', reason: 'onset_not_applicable' });
  });
  it('treats a missing sensitivity share as weak', () => {
    expect(decideShift({ ...base, agreeingShare: null }).confidence).toBe('weak');
  });
  it('does not call "no shift" reliable when the start boundary is saturated', () => {
    expect(decideShift({ ...base, verdict: 'no_distinguishable_shift', saturated: true })).toEqual({
      action: 'none', shiftDays: null, confidence: 'weak', reason: 'start_boundary_saturated',
    });
  });
  it('still reports a measured shift when the boundary is saturated (the report carries the bias note)', () => {
    expect(decideShift({ ...base, saturated: true }).action).toBe('delay');
  });
});

describe('plantingWindowAnalysis', () => {
  // Early period: rain starts 10-13 June. Late period: rain starts 27-30 June.
  // Hand calculation: the offsets (year % 4) have median 1.5 in 2001-2012 and median 1 in 2013-2025,
  // so the shift of the medians is 17 - 0.5 = 16.5 days, which rounds to a 17-day recommendation.
  const shifted = seriesWithOnset({
    early: (y) => [6, 10 + (y % 4)],
    late: (y) => [6, 27 + (y % 4)],
    lateTmax: 34,
  });

  it('detects a known later onset (16.5 days by hand) and recommends delaying by 17 days', () => {
    const result = plantingWindowAnalysis(shifted, AMAN);
    expect(result.onset.analysis.verdict).toBe('later_onset');
    expect(result.onset.analysis.shiftDays).toBe(16.5);
    expect(result.onset.analysis.earlyYears).toBe(12);
    expect(result.onset.analysis.lateYears).toBe(13);
    expect(result.recommendation).toMatchObject({ action: 'delay', shiftDays: 17, confidence: 'supported' });
    expect(result.onset.sensitivity.agreeingShare).toBeGreaterThanOrEqual(0.6);
  });

  it('reports the onset day of the first rainy day minus two (hand-checked for 2001)', () => {
    const result = plantingWindowAnalysis(shifted, AMAN);
    const y2001 = result.onset.yearly.find((p) => p.year === 2001);
    // 2001 % 4 = 1, so rain starts 11 June; the first 7-day window with 5 rainy days starts 9 June
    // (day 160 of a non-leap year: 31 + 28 + 31 + 30 + 31 + 9).
    expect(y2001.status).toBe('onset');
    expect(y2001.value).toBe(160);
    expect(dayOfYearUtc(2001, 6, 9) + 1).toBe(160);
  });

  it('detects the known growing-degree-day increase (1 GDD per day x 153 days)', () => {
    const result = plantingWindowAnalysis(shifted, AMAN);
    expect(result.gdd.analysis.shiftGdd).toBe(153);
    expect(result.gdd.analysis.verdict).toBe('higher_gdd');
    expect(result.gdd.analysis).not.toHaveProperty('shiftDays');
  });

  it('keeps provenance of the definitions used', () => {
    const result = plantingWindowAnalysis(shifted, AMAN);
    expect(result.onset.definition).toEqual({ startMonth: 6, endMonth: 8, windowDays: 7, thresholdMm: 50 }); // Aman
    expect(result.gdd.parameters).toEqual({ baseC: 10, capC: 35 });
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('finds no distinguishable shift in a series with no change, and recommends nothing', () => {
    // Rain starts 10-13 June in both periods: inside the Aman search window, so not on the boundary.
    const flat = seriesWithOnset({ early: (y) => [6, 10 + (y % 4)], late: (y) => [6, 10 + (y % 4)] });
    const result = plantingWindowAnalysis(flat, AMAN);
    expect(result.onset.analysis.verdict).toBe('no_distinguishable_shift');
    expect(result.recommendation).toMatchObject({ action: 'none', shiftDays: 0 });
  });

  it('does not recommend an onset shift for Boro even when the onset moved', () => {
    const result = plantingWindowAnalysis(shifted, BORO);
    expect(result.onset.applies).toBe(false);
    expect(result.onset.analysis).toBeNull();
    expect(result.recommendation).toMatchObject({ action: 'none', confidence: 'not_applicable' });
    expect(result.gdd.yearly.length).toBeGreaterThan(0); // GDD is still reported for Boro
  });

  it('gives different advice to Aus and Aman from the same series (early May rain moved, June onset did not)', () => {
    // Early period: rain starts 25-28 May (median 26.5 May). Late period: rain starts 8-11 May
    // (median 9 May). By hand the Aus onset is 9 - 26.5 = 17.5 days earlier; the same two-day window
    // offset applies to both periods and cancels.
    // For Aman the search starts on 1 June, when it is already raining in every year, so onset is
    // the same day (1 June) in both periods. That is the boundary-saturated case: "no shift" is
    // not reliable, because the true onset may be earlier than the search can see.
    const mayShift = seriesWithOnset({ early: (y) => [5, 25 + (y % 4)], late: (y) => [5, 8 + (y % 4)] });
    const aus = plantingWindowAnalysis(mayShift, AUS);
    expect(aus.onset.definition.startMonth).toBe(5);
    expect(aus.onset.analysis.verdict).toBe('earlier_onset');
    expect(aus.onset.analysis.shiftDays).toBe(-17.5);
    expect(aus.recommendation).toMatchObject({ action: 'advance', shiftDays: 18, confidence: 'supported' });
    // robustness only varies threshold and window, so every sensitivity row keeps the 1 May start
    expect(aus.onset.sensitivity.definitionsTried).toBe(15);

    const aman = plantingWindowAnalysis(mayShift, AMAN);
    expect(aman.onset.analysis.verdict).toBe('no_distinguishable_shift');
    expect(aman.onset.boundary.saturated).toBe(true);
    expect(aman.recommendation).toMatchObject({ action: 'none', shiftDays: null, confidence: 'weak', reason: 'start_boundary_saturated' });
  });

  it('reports insufficient data for a very short series', () => {
    const short = buildSeries(2001, 2004, () => ({ precipMm: 10, tMaxC: 32, tMinC: 22 }));
    const result = plantingWindowAnalysis(short, AMAN);
    expect(result.onset.analysis.verdict).toBe('insufficient_data');
    expect(result.recommendation.action).toBe('none');
  });

  it('is deterministic', () => {
    expect(plantingWindowAnalysis(shifted, AMAN)).toEqual(plantingWindowAnalysis(shifted, AMAN));
  });

  it('rejects a series with a duplicate date instead of guessing', () => {
    const bad = [...shifted, { ...shifted[0] }];
    expect(() => plantingWindowAnalysis(bad, AMAN)).toThrow(/Duplicate date/);
  });

  it('treats a year without any qualifying rain as censored, not dropped', () => {
    const dry = buildSeries(2001, 2025, (y, m) => ({ precipMm: y >= 2013 && m <= 8 ? 0 : (m <= 8 && m >= 5 ? 10 : 0), tMaxC: 32, tMinC: 22 }));
    const result = plantingWindowAnalysis(dry, AMAN);
    expect(result.onset.analysis.censoredYears).toBe(13);
    expect(result.onset.analysis.verdict).toBe('later_onset');
  });

  it('uses isoDate-compatible dates in its yearly output', () => {
    const result = plantingWindowAnalysis(shifted, AMAN);
    expect(isoDate(2001, 6, 9)).toBe('2001-06-09');
    expect(result.onset.yearly[0].year).toBe(2001);
  });
});
describe('boundary saturation (onset on the first allowed day)', () => {
  // Aman search starts 1 June = fixed-365 day 152. Rain from 15 May puts every onset on 1 June.
  const rainFrom15May = () => [5, 15];
  const saturatedSeries = seriesWithOnset({ early: rainFrom15May, late: rainFrom15May });

  it('counts years sitting on the start day per period (hand-checked: 12 early years, 13 late years, all on day 152)', () => {
    const r = plantingWindowAnalysis(saturatedSeries, AMAN);
    expect(r.onset.boundary.startDay).toBe(152);
    expect(r.onset.boundary.early).toEqual({ years: 12, atStart: 12, share: 1 });
    expect(r.onset.boundary.late).toEqual({ years: 13, atStart: 13, share: 1 });
    expect(r.onset.boundary.saturated).toBe(true);
  });
  it('says "no shift" is not reliable instead of recommending nothing confidently', () => {
    const r = plantingWindowAnalysis(saturatedSeries, AMAN);
    expect(r.recommendation).toEqual({ action: 'none', shiftDays: null, confidence: 'weak', reason: 'start_boundary_saturated' });
  });
  it('is not saturated when onsets are well inside the search window', () => {
    const inside = seriesWithOnset({ early: (y) => [6, 10 + (y % 4)], late: (y) => [6, 27 + (y % 4)] });
    const r = plantingWindowAnalysis(inside, AMAN);
    expect(r.onset.boundary.saturated).toBe(false);
    expect(r.onset.boundary.magnitudeBias).toBeNull();
    expect(r.recommendation.action).toBe('delay');
  });
  it('flags a delay whose early period is saturated as possibly understated', () => {
    const r = plantingWindowAnalysis(seriesWithOnset({ early: rainFrom15May, late: (y) => [6, 27 + (y % 4)] }), AMAN);
    expect(r.recommendation.action).toBe('delay');
    expect(r.onset.boundary.early.share).toBe(1);
    expect(r.onset.boundary.magnitudeBias).toBe('may_be_understated');
  });
  it('boundaryReport ignores unknown years and uses the crop start month', () => {
    const yearly = [
      { year: 2001, status: 'onset', value: 121 },
      { year: 2002, status: 'unknown' },
      { year: 2013, status: 'onset', value: 130 },
    ];
    const r = boundaryReport(yearly, 5, 2013); // 1 May = day 121
    expect(r.early).toEqual({ years: 1, atStart: 1, share: 1 });
    expect(r.late).toEqual({ years: 1, atStart: 0, share: 0 });
  });
});
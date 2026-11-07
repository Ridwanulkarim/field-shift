// Edge cases of the onset calculation: missing days, partial years, leap years, boundary dates, years without an onset.
// All series are hand-built FIXTURES (not NASA data); every expected day number is worked out by hand in the comments.
// Aman definition: first 7-day total of at least 50 mm, search from 1 June to 31 August.

import { describe, it, expect } from 'vitest';
import { monsoonOnsetByYear } from '../src/science/climate.js';
import { plantingWindowAnalysis } from '../src/science/plantingWindow.js';
import { mannWhitney, analyzeOnsetShift } from '../src/science/onsetAnalysis.js';
import { shiftEstimate } from '../src/science/farmerAdvisory.js';
import { ONSET_BY_CROP } from '../src/science/rules.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';

const AMAN = ONSET_BY_CROP.aman;
const aman = CROPS.find((c) => c.slug === 'aman');
const MD = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
// 10 mm every day from `m/d` onwards (to the end of August), none before.
const rainFrom = (m0, d0, amount = 10) => (y, m, d) => ({ precipMm: m <= 8 && (m > m0 || (m === m0 && d >= d0)) ? amount : 0, tMaxC: 32, tMinC: 22 });
const onset = (series) => monsoonOnsetByYear(series, AMAN);
const byYear = (rows, year) => rows.find((r) => r.year === year);

describe('onset day numbers (hand-checked)', () => {
  // Rain from 10 June: the 7-day window starting 8 June holds 10, 11, 12, 13, 14 June = 5 x 10 = 50 mm, the first to qualify.
  // 8 June is day 31 + 28 + 31 + 30 + 31 + 8 = 159 on the fixed 365-day calendar.
  it('finds 8 June (day 159) when rain starts on 10 June, in leap and non-leap years alike', () => {
    const rows = onset(buildSeries(2001, 2004, rainFrom(6, 10)));
    expect(rows.map((r) => [r.year, r.status, r.value])).toEqual([[2001, 'onset', 159], [2002, 'onset', 159], [2003, 'onset', 159], [2004, 'onset', 159]]);
  });
});

describe('missing days', () => {
  // One missing day (14 June) makes every window that contains it unobserved: starts 8 to 14 June. The first
  // observed qualifying window starts on 15 June (70 mm) = day 166, and an earlier onset cannot be ruled out.
  it('flags an onset that follows unobserved windows and does not move it earlier', () => {
    const s = buildSeries(2002, 2002, (y, m, d) => (m === 6 && d === 14 ? { precipMm: null, tMaxC: 32, tMinC: 22 } : rainFrom(6, 10)(y, m, d)));
    expect(onset(s)[0]).toMatchObject({ year: 2002, status: 'onset', value: 166, earlierWindowsUnobserved: true });
  });
  it('ignores a missing day that cannot affect any window before the onset', () => {
    const s = buildSeries(2002, 2002, (y, m, d) => (m === 8 && d === 20 ? { precipMm: null, tMaxC: 32, tMinC: 22 } : rainFrom(6, 10)(y, m, d)));
    expect(onset(s)[0]).toMatchObject({ status: 'onset', value: 159, earlierWindowsUnobserved: false });
  });
  it('treats a year with a flagged onset as unknown in the planting analysis, not as a clean value', () => {
    const rows = buildSeries(2001, 2010, (y, m, d) => (y === 2005 && m === 6 && d === 14 ? { precipMm: null, tMaxC: 32, tMinC: 22 } : rainFrom(6, 10)(y, m, d)));
    const a = plantingWindowAnalysis(rows, aman, { splitYear: 2006 });
    expect(a.onset.analysis.excludedYears).toBe(1);
    expect(a.onset.analysis.earlyYears).toBe(4); // 2001-2004; 2005 is excluded
  });
});

describe('partial years (data that end inside or before the season)', () => {
  const upTo = (series, lastIso) => series.filter((r) => r.date <= lastIso);
  it('keeps an onset found before the data end: that part of the year was fully observed', () => {
    const s = upTo(buildSeries(2003, 2003, rainFrom(6, 10)), MD(2003, 7, 20));
    expect(onset(s)[0]).toMatchObject({ status: 'onset', value: 159, earlierWindowsUnobserved: false });
  });
  it('calls a year unknown, never no_onset, when the data end before any rain was seen', () => {
    const s = upTo(buildSeries(2003, 2003, rainFrom(6, 10)), MD(2003, 6, 5));
    expect(onset(s)[0]).toMatchObject({ status: 'unknown', value: null });
  });
  it('calls a dry year unknown, not no_onset, when the data end before the season is over', () => {
    const s = upTo(buildSeries(2003, 2003, () => ({ precipMm: 0, tMaxC: 32, tMinC: 22 })), MD(2003, 8, 20));
    expect(onset(s)[0].status).toBe('unknown');
  });
  it('calls a dry year no_onset only when the whole season was observed', () => {
    const s = upTo(buildSeries(2003, 2003, () => ({ precipMm: 0, tMaxC: 32, tMinC: 22 })), MD(2003, 8, 31));
    expect(onset(s)[0].status).toBe('no_onset');
  });
  it('flags the first year when the series starts after the season has begun', () => {
    const s = buildSeries(2003, 2003, rainFrom(6, 10)).filter((r) => r.date >= MD(2003, 6, 12));
    expect(onset(s)[0]).toMatchObject({ status: 'onset', earlierWindowsUnobserved: true });
  });
});

describe('boundary dates', () => {
  it('reports the first allowed day (1 June = day 152) when rain is already falling', () => {
    const s = buildSeries(2003, 2003, (y, m, d) => ({ precipMm: (m === 5 && d >= 25) || (m >= 6 && m <= 8) ? 10 : 0, tMaxC: 32, tMinC: 22 }));
    expect(onset(s)[0]).toMatchObject({ status: 'onset', value: 152 });
  });
  // The last window that fits inside the season starts on 25 August (25-31 August); 25 August is day 237.
  it('accepts a qualifying window on the very last allowed days (day 237)', () => {
    const s = buildSeries(2003, 2003, (y, m, d) => ({ precipMm: m === 8 && d === 31 ? 100 : 0, tMaxC: 32, tMinC: 22 }));
    expect(onset(s)[0]).toMatchObject({ status: 'onset', value: 237 });
  });
  it('does not look past 31 August: rain that starts on 1 September is no onset', () => {
    const s = buildSeries(2003, 2003, (y, m) => ({ precipMm: m >= 9 ? 100 : 0, tMaxC: 32, tMinC: 22 }));
    expect(onset(s)[0].status).toBe('no_onset');
  });
  it('treats exactly 50 mm as qualifying and 49.9 mm as not', () => {
    const at = (mm) => onset(buildSeries(2003, 2003, (y, m, d) => ({ precipMm: m === 7 && d >= 1 && d <= 7 ? mm / 7 : 0, tMaxC: 32, tMinC: 22 })))[0];
    expect(at(50)).toMatchObject({ status: 'onset' });
    expect(at(49.9).status).toBe('no_onset');
  });
});

describe('years without a confirmed onset in the comparison', () => {
  it('keeps no_onset years in the later period as censored, so a later onset is not made to look smaller', () => {
    const s = buildSeries(2001, 2012, (y, m, d) => (y >= 2007 ? { precipMm: 0, tMaxC: 32, tMinC: 22 } : rainFrom(6, 10)(y, m, d)));
    const a = plantingWindowAnalysis(s, aman, { splitYear: 2007 });
    expect(a.onset.analysis.censoredYears).toBe(6);
    expect(a.onset.analysis.lateYears).toBe(6); // not dropped
    expect(a.onset.analysis.verdict).toBe('later_onset');
  });
});

describe('the statistics behind the Rajshahi example', () => {
  // Onset days copied from the real advisory response for Rajshahi Aman (NASA POWER run 85, 2026-11-07), used here only as
  // test values. Expected p-value computed independently with scipy 1.18.1 (mannwhitneyu, asymptotic, tie-corrected,
  // continuity-corrected): 0.8736517974015894.
  const early = [152, 152, 152, 152, 152, 153, 154, 160, 163, 169, 175, 176];
  const late = [152, 152, 152, 152, 152, 154, 154, 156, 160, 161, 163, 165, 170, 178];
  const rows = [...early.map((value, i) => ({ year: 2001 + i, status: 'onset', value })), ...late.map((value, i) => ({ year: 2013 + i, status: 'onset', value }))];
  it('matches the independent p-value and gives no distinguishable shift', () => {
    const r = mannWhitney(early, late);
    expect(r.method).toBe('asymptotic');
    expect(r.pValue).toBeCloseTo(0.8736518, 6);
    const a = analyzeOnsetShift(rows, { splitYear: 2013 });
    expect(a).toMatchObject({ verdict: 'no_distinguishable_shift', earlyMedian: 153.5, lateMedian: 155, shiftDays: 1.5 });
  });
  it('reports an interval wide enough that an 8-day shift either way is not excluded', () => {
    const est = shiftEstimate(rows, 2013);
    expect(est.estimateDays).toBe(0); // independently: median of the 168 pairwise differences = 0
    expect(est.interval95Days).toEqual([-8, 7]); // independently computed in Python with the same formula
  });
  it('returns no estimate with fewer than three usable years in a period', () => {
    expect(shiftEstimate(rows.slice(0, 13), 2013)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { compareOnsetSeries, compareShiftVerdicts, firstDayShare } from '../src/science/sourceComparison.js';

const onset = (year, value, extra = {}) => ({ year, status: 'onset', value, earlierWindowsUnobserved: false, ...extra });
const none = (year) => ({ year, status: 'no_onset', value: null, earlierWindowsUnobserved: false });

describe('compareOnsetSeries', () => {
  it('reports identical sources as identical', () => {
    const a = [onset(2001, 160), onset(2002, 170), onset(2003, 155), onset(2004, 180)];
    const { rows, summary } = compareOnsetSeries(a, a);
    expect(rows.every((r) => r.diffDays === 0)).toBe(true);
    expect(summary).toMatchObject({ yearsBothOnset: 4, medianDiffDays: 0, medianAbsDiffDays: 0, within3DaysShare: 1, within7DaysShare: 1, yearsDifferentStatus: 0 });
    expect(summary.correlation).toBe(1);
  });
  it('signs the difference as second minus first and measures how many years are close', () => {
    const a = [onset(2001, 160), onset(2002, 170), onset(2003, 155), onset(2004, 180)];
    const b = [onset(2001, 163), onset(2002, 160), onset(2003, 156), onset(2004, 181)];
    const { rows, summary } = compareOnsetSeries(a, b);
    expect(rows.map((r) => r.diffDays)).toEqual([3, -10, 1, 1]);
    expect(summary.medianDiffDays).toBe(1);
    expect(summary.within3DaysShare).toBe(0.75);
    expect(summary.within7DaysShare).toBe(0.75);
  });
  it('counts years where one source finds an onset and the other does not, and leaves them out of the day differences', () => {
    const { rows, summary } = compareOnsetSeries([onset(2001, 160), none(2002)], [onset(2001, 160), onset(2002, 200)]);
    expect(rows[1]).toMatchObject({ a: 'no_onset', b: 200, diffDays: null, sameStatus: false });
    expect(summary).toMatchObject({ yearsCompared: 2, yearsBothOnset: 1, yearsDifferentStatus: 1 });
  });
  it('treats a year with unobserved earlier windows as unknown, not as a date', () => {
    const { rows } = compareOnsetSeries([onset(2001, 160, { earlierWindowsUnobserved: true })], [onset(2001, 160)]);
    expect(rows[0]).toMatchObject({ a: 'unknown', diffDays: null });
  });
  it('only compares years both sources have, and copes with no overlap', () => {
    expect(compareOnsetSeries([onset(2001, 160)], [onset(2005, 160)]).summary.yearsCompared).toBe(0);
    const empty = compareOnsetSeries([], []);
    expect(empty.summary).toMatchObject({ yearsCompared: 0, medianDiffDays: null, correlation: null, within7DaysShare: null });
  });
});

describe('compareShiftVerdicts', () => {
  const years = (f) => Array.from({ length: 24 }, (_, i) => onset(2001 + i, f(2001 + i)));
  it('says the verdicts match when both sources show the same later shift', () => {
    const a = years((y) => (y < 2013 ? 150 + (y % 3) : 170 + (y % 3)));
    const b = years((y) => (y < 2013 ? 152 + (y % 3) : 171 + (y % 3)));
    const r = compareShiftVerdicts(a, b);
    expect(r.a.verdict).toBe('later_onset');
    expect(r.b.verdict).toBe('later_onset');
    expect(r.sameVerdict).toBe(true);
  });
  it('shows when one source finds a shift and the other does not', () => {
    const a = years((y) => (y < 2013 ? 150 + (y % 3) : 170 + (y % 3)));
    const b = years((y) => 160 + (y % 5));
    const r = compareShiftVerdicts(a, b);
    expect(r.a.verdict).toBe('later_onset');
    expect(r.b.verdict).toBe('no_distinguishable_shift');
    expect(r.sameVerdict).toBe(false);
  });
});

describe('firstDayShare', () => {
  it('is the share of onsets on the first allowed day', () => {
    expect(firstDayShare([onset(2001, 152), onset(2002, 152), onset(2003, 160), onset(2004, 170)], 152)).toBe(0.5);
  });
  it('is null when there are no onsets', () => {
    expect(firstDayShare([none(2001)], 152)).toBeNull();
  });
});

import { lagCorrelations, crossCheckSummary } from '../src/science/sourceComparison.js';

describe('lagCorrelations', () => {
  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2020, 5, 1 + i)).toISOString().slice(0, 10));
  const storm = (i) => (i % 7 === 0 ? 40 : i % 5 === 0 ? 10 : 0);
  const a = days.map((date, i) => ({ date, precipMm: storm(i) }));
  it('finds lag 0 for aligned series', () => {
    const r = lagCorrelations(a, a);
    expect(r.bestLag).toBe(0);
    expect(r.correlations.find((c) => c.lag === 0).r).toBe(1);
  });
  it('finds lag +1 when the second source labels every storm one day later', () => {
    const b = days.map((date, i) => ({ date, precipMm: storm(i - 1) }));
    expect(lagCorrelations(a, b).bestLag).toBe(1);
  });
  it('ignores days with a missing value and copes with no overlap', () => {
    const b = a.map((r, i) => (i % 2 ? r : { ...r, precipMm: null }));
    expect(lagCorrelations(a, b).correlations.find((c) => c.lag === 0).n).toBe(30);
    expect(lagCorrelations([], []).bestLag).toBeNull();
  });
});

describe('crossCheckSummary', () => {
  const report = {
    comparedRange: { first: '2001-01-01', last: '2025-12-31' }, chirpsRetrievedAt: '2026-11-13T00:00:00Z', chirpsSha256: 'abc',
    crops: { aman: { verdicts: { sameVerdict: true, a: { verdict: 'no_distinguishable_shift', shiftDays: 2.5 }, b: { verdict: 'no_distinguishable_shift', shiftDays: 3.5 } },
      summary: { yearsCompared: 25, medianAbsDiffDays: 4, within7DaysShare: 0.68, correlation: 0.37 }, firstDayShare: { power: 0.4, chirps: 0.36 } } },
  };
  it('keeps only what the advisory page needs', () => {
    expect(crossCheckSummary(report, 'aman')).toMatchObject({ sameVerdict: true, powerShiftDays: 2.5, chirpsShiftDays: 3.5, yearsCompared: 25, within7DaysShare: 0.68, chirpsSha256: 'abc' });
  });
  it('is null for a crop that was not compared or a missing report', () => {
    expect(crossCheckSummary(report, 'aus')).toBeNull();
    expect(crossCheckSummary(null, 'aman')).toBeNull();
  });
});

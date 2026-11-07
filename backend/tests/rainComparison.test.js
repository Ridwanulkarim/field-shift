import { describe, it, expect } from 'vitest';
import { compareRainfall, pearson, COMPARISON_RULES } from '../src/science/rainComparison.js';

// Synthetic test series (NOT NASA data): one value per day, with a dry pre-monsoon, a wet monsoon from `onset`, and a
// light post-monsoon. `scale` multiplies the rain, `shiftDays` moves the onset.
function makeSeries(years, { onset = '06-01', shiftDays = 0, scale = 1 } = {}) {
  const out = [];
  for (const year of years) {
    const onsetMs = Date.parse(`${year}-${onset}T00:00:00Z`) + shiftDays * 86400000;
    for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += 86400000) {
      const d = new Date(t);
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      let mm = 0;
      if (t >= onsetMs && month <= 9) mm = 10 + (day % 4);
      else if (month >= 10) mm = day % 3 === 0 ? 3 : 0;
      out.push({ date: d.toISOString().slice(0, 10), precipMm: Math.round(mm * scale * 100) / 100 });
    }
  }
  return out;
}
const YEARS = [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008];

describe('pearson', () => {
  it('is 1 for a perfect line, -1 for a falling line, null when undefined', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(pearson([1, 2], [1, 2])).toBeNull();            // too few points
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();      // no variance
  });
});

describe('compareRainfall', () => {
  it('reports perfect agreement for identical series', () => {
    const s = makeSeries(YEARS);
    const c = compareRainfall(s, s);
    expect(c.status).toBe('ok');
    expect(c.daily).toMatchObject({ biasMmPerDay: 0, imergToPowerRatio: 1, correlation: 1, wetDryAgreementShare: 1 });
    expect(c.monthly.correlation).toBe(1);
    expect(c.season.years).toBe(8);
    expect(c.season.imergToPowerRatio).toBe(1);
    expect(c.onset.years).toBe(8);
    expect(c.onset.medianDifferenceDays).toBe(0);
    expect(c.flags).toEqual([]);
  });

  it('flags a wetter IMERG and measures the bias', () => {
    const power = makeSeries(YEARS);
    const imerg = makeSeries(YEARS, { scale: 1.5 });
    const c = compareRainfall(power, imerg);
    expect(c.daily.imergToPowerRatio).toBeGreaterThan(1.4);
    expect(c.daily.biasMmPerDay).toBeGreaterThan(0);
    expect(c.flags).toContain('IMERG_WETTER_THAN_POWER');
    expect(c.monthly.correlation).toBeGreaterThan(0.99); // same shape, different size
  });

  it('flags a drier IMERG', () => {
    expect(compareRainfall(makeSeries(YEARS), makeSeries(YEARS, { scale: 0.5 })).flags).toContain('IMERG_DRIER_THAN_POWER');
  });

  it('measures the onset difference in days (positive = IMERG later)', () => {
    const c = compareRainfall(makeSeries(YEARS), makeSeries(YEARS, { shiftDays: 10 }));
    expect(c.onset.years).toBe(8);
    expect(c.onset.medianDifferenceDays).toBe(10);
    expect(c.onset.meanDifferenceDays).toBe(10);
    expect(c.onset.shareWithinDays).toBe(0); // 10 days is outside the 7-day tolerance
    expect(c.onset.yearly.every((y) => y.differenceDays === 10)).toBe(true);
  });

  it('refuses statistics when the overlap is too short', () => {
    const c = compareRainfall(makeSeries([2001]).slice(0, 100), makeSeries([2001]).slice(0, 100));
    expect(c.status).toBe('insufficient_overlap');
    expect(c.pairedDays).toBe(100);
    expect(c.flags).toEqual(['SHORT_OVERLAP']);
    expect(c.daily).toBeUndefined();
  });

  it('handles no overlap at all', () => {
    const c = compareRainfall(makeSeries([2001]), makeSeries([2005]));
    expect(c.status).toBe('insufficient_overlap');
    expect(c.pairedDays).toBe(0);
    expect(c.overlap).toBeNull();
  });

  it('compares only days where BOTH values exist: a missing day is not zero', () => {
    const power = makeSeries(YEARS);
    const imerg = makeSeries(YEARS).map((d, i) => (i % 2 === 0 ? { ...d, precipMm: null } : d));
    const c = compareRainfall(power, imerg);
    expect(c.pairedDays).toBe(power.length / 2);
    expect(c.daily.imergToPowerRatio).toBe(1); // the paired days are identical, so nulls did not drag the total down
  });

  it('uses only the overlapping period when one series is longer', () => {
    const c = compareRainfall(makeSeries(YEARS), makeSeries(YEARS.slice(2)));
    expect(c.overlap).toEqual({ firstDate: '2003-01-01', lastDate: '2008-12-31' });
  });

  it('excludes months and seasons that are not nearly complete', () => {
    const power = makeSeries(YEARS);
    const imerg = makeSeries(YEARS).filter((d) => !(d.date.startsWith('2004-07') || d.date.startsWith('2004-08'))); // two missing months
    const c = compareRainfall(power, imerg);
    expect(c.season.years).toBe(7); // 2004's monsoon season is incomplete
    expect(c.season.yearly.find((y) => y.year === 2004)).toBeUndefined();
  });

  it('reports no onset statistics without enough confirmed years', () => {
    const c = compareRainfall(makeSeries([2001, 2002]), makeSeries([2001, 2002]));
    // 2 years = 730 paired days, enough for the overall statistics but not for onset or seasonal correlation
    expect(c.status).toBe('ok');
    expect(c.onset.years).toBe(2);
    expect(c.onset.medianDifferenceDays).toBeNull();
    expect(c.season.correlation).toBeNull();
  });

  it('rejects a series with a duplicate date instead of guessing', () => {
    const s = makeSeries([2001]);
    expect(() => compareRainfall([...s, s[0]], s)).toThrow(/Duplicate date/);
  });

  it('documents its thresholds as heuristics', () => {
    const c = compareRainfall(makeSeries(YEARS), makeSeries(YEARS));
    expect(c.thresholds.note).toMatch(/not validated/);
    expect(c.thresholds.minPairedDays).toBe(COMPARISON_RULES.minPairedDays);
  });
});

import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, indexSeries, windowSum, cycleDates, dayOfYearFixed365 } from '../src/science/series.js';

const row = (date, precipMm) => ({ date, precipMm, tMaxC: 30, tMinC: 20 });

describe('date arithmetic', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2011-12-31', 1)).toBe('2012-01-01');
    expect(addDays('2012-02-28', 1)).toBe('2012-02-29');
    expect(addDays('2011-02-28', 1)).toBe('2011-03-01');
    expect(daysBetween('2012-01-01', '2012-12-31')).toBe(365);
  });
});

describe('indexSeries', () => {
  it('rejects duplicate and malformed dates', () => {
    expect(() => indexSeries([row('2001-05-01', 1), row('2001-05-01', 2)])).toThrow(/Duplicate/);
    expect(() => indexSeries([row('2001/05/01', 1)])).toThrow(/Invalid date/);
  });
});

describe('windowSum', () => {
  const idx = indexSeries([row('2001-05-01', 10), row('2001-05-02', 10), row('2001-05-03', null), row('2001-05-05', 10)]);
  it('is null unless the required days are observed', () => {
    const w = windowSum(idx, '2001-05-01', 5, 'precipMm', 5);
    expect(w.sum).toBeNull();
    expect(w.observed).toBe(3);
    expect(w.missing).toBe(2); // 3 May is null, 4 May has no row
  });
  it('sums when enough days are observed', () => {
    expect(windowSum(idx, '2001-05-01', 5, 'precipMm', 3).sum).toBe(30);
  });
  it('counts an absent row as unknown, not zero', () => {
    expect(windowSum(idx, '2001-05-04', 2, 'precipMm', 2).sum).toBeNull();
  });
});

describe('cycleDates', () => {
  it('returns every calendar day, including a wrapping window and a leap February', () => {
    const d = cycleDates(2011, 11, 3);
    expect(d[0]).toBe('2011-11-01');
    expect(d[d.length - 1]).toBe('2012-03-31');
    expect(d).toHaveLength(30 + 31 + 31 + 29 + 31);
  });
});

describe('dayOfYearFixed365', () => {
  it('gives the same day number to the same calendar date in leap and non-leap years', () => {
    expect(dayOfYearFixed365('2011-06-01')).toBe(152);
    expect(dayOfYearFixed365('2012-06-01')).toBe(152);
    expect(dayOfYearFixed365('2012-02-29')).toBe(59);
    expect(dayOfYearFixed365('2012-12-31')).toBe(365);
  });
});

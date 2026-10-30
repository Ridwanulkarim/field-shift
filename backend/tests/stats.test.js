import { describe, it, expect } from 'vitest';
import { mean, linearRegression, trendSummary, round } from '../src/science/stats.js';

describe('mean', () => {
  it('averages numbers', () => expect(mean([1, 2, 3, 4])).toBe(2.5));
  it('ignores null and NaN instead of counting them as zero', () => {
    expect(mean([2, null, 4, NaN])).toBe(3);
  });
  it('returns null when there is nothing to average', () => {
    expect(mean([])).toBeNull();
    expect(mean([null, null])).toBeNull();
  });
});

describe('round', () => {
  it('rounds to digits and passes through null', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(null)).toBeNull();
    expect(round(Infinity)).toBeNull();
  });
});

describe('linearRegression', () => {
  it('recovers an exact line y = 2x + 1', () => {
    const fit = linearRegression([0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * x + 1 })));
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(1, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
    expect(fit.perfectFit).toBe(true);
  });
  it('matches a hand-computed noisy example', () => {
    // x = 1..5, y = 2, 4, 5, 4, 5 -> slope 0.6, intercept 2.2 (textbook example)
    const fit = linearRegression([2, 4, 5, 4, 5].map((y, i) => ({ x: i + 1, y })));
    expect(fit.slope).toBeCloseTo(0.6, 10);
    expect(fit.intercept).toBeCloseTo(2.2, 10);
    expect(fit.r2).toBeCloseTo(0.6, 10);
  });
  it('refuses to fit fewer than 3 points or identical x values', () => {
    expect(linearRegression([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(linearRegression([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }])).toBeNull();
  });
});

describe('trendSummary', () => {
  const years = (f, n = 20) => Array.from({ length: n }, (_, i) => ({ year: 2000 + i, value: f(i) }));

  it('reports insufficient data for short series', () => {
    expect(trendSummary(years((i) => i, 6)).verdict).toBe('insufficient_data');
    expect(trendSummary([]).verdict).toBe('insufficient_data');
  });
  it('detects a clean upward trend of 1.5 per year as 15 per decade', () => {
    const t = trendSummary(years((i) => 100 + 1.5 * i));
    expect(t.slopePerDecade).toBe(15);
    expect(t.verdict).toBe('distinguishable_from_noise');
    expect(t.recentMean).toBeGreaterThan(t.earlyMean);
  });
  it('does not call a flat noisy series a trend', () => {
    const noise = [3, -2, 1, -4, 2, 5, -3, 0, 4, -1, -5, 2, 3, -2, 1, 0, -3, 4, -1, 2];
    const t = trendSummary(years((i) => 50 + noise[i]));
    expect(t.verdict).toBe('not_distinguishable_from_noise');
  });
  it('skips null values', () => {
    const data = years((i) => 10 + i);
    data[3].value = null;
    expect(trendSummary(data).n).toBe(19);
  });
});

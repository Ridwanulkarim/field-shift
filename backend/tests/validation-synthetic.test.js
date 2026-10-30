import { describe, it, expect } from 'vitest';
import { generateSyntheticSeries, hashString } from '../src/integrations/fixture/synthetic.js';
import { climateIndicators } from '../src/science/climate.js';

// Scientific validation on data with NO trend by construction.
// If the trend code were biased, stationary synthetic series would show "trends" far more
// often than chance. A |t| >= 2 rule should flag roughly 5-6% of flat series by luck alone,
// which is exactly why the API calls the flag a "rough hint" and never proof.
describe('trend detection on stationary synthetic data', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => 1000 + i);
  const results = seeds.flatMap((seed) =>
    climateIndicators(generateSyntheticSeries({ startYear: 2001, endYear: 2025, seed })),
  );

  it('flags only a small share of trend-free series (false-positive rate near 5%)', () => {
    const flagged = results.filter((r) => r.trend.verdict === 'distinguishable_from_noise').length;
    const rate = flagged / results.length;
    expect(rate).toBeGreaterThan(0.01);
    expect(rate).toBeLessThan(0.12);
  });

  it('finds no systematic slope direction', () => {
    for (const id of ['monsoonRain', 'rabiRain', 'preMonsoonHeatDays']) {
      const slopes = results.filter((r) => r.id === id).map((r) => r.trend.slopePerDecade);
      const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
      const sd = Math.sqrt(slopes.reduce((a, b) => a + (b - meanSlope) ** 2, 0) / slopes.length);
      // The average slope over 60 independent series should be within ~3 standard errors of zero.
      expect(Math.abs(meanSlope)).toBeLessThan((3 * sd) / Math.sqrt(slopes.length));
    }
  });

  it('is reproducible: same seed, same series', () => {
    const a = generateSyntheticSeries({ startYear: 2001, endYear: 2003, seed: hashString('rajshahi') });
    const b = generateSyntheticSeries({ startYear: 2001, endYear: 2003, seed: hashString('rajshahi') });
    expect(a).toEqual(b);
  });

  it('stays physically plausible', () => {
    const s = generateSyntheticSeries({ startYear: 2001, endYear: 2005, seed: 5 });
    expect(s.every((d) => d.precipMm >= 0 && d.tMaxC > d.tMinC)).toBe(true);
    expect(s).toHaveLength(1826);
  });
});

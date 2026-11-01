import { describe, it, expect } from 'vitest';
import { onsetSensitivity } from '../src/science/onsetSensitivity.js';
import { generateSyntheticSeries } from '../src/integrations/fixture/synthetic.js';

describe('onsetSensitivity', () => {
  it('returns one row per definition and no shift verdict stays fixed across them for trend-free synthetic data', () => {
    // SYNTHETIC, trend-free by construction: not NASA data.
    const series = generateSyntheticSeries({ startYear: 2001, endYear: 2025, seed: 7 });
    const rows = onsetSensitivity(series, { splitYear: 2013 });
    expect(rows).toHaveLength(2 * 3 * 5);
    expect(rows.every((r) => typeof r.verdict === 'string')).toBe(true);
    const flagged = rows.filter((r) => r.verdict === 'later_onset' || r.verdict === 'earlier_onset').length;
    expect(flagged).toBeLessThan(rows.length / 2); // no systematic false shift
  });
});

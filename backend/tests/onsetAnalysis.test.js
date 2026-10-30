import { describe, expect, it } from 'vitest';
import { analyzeOnsetShift, mannWhitney } from '../src/science/onsetAnalysis.js';

describe('mannWhitney', () => {
  it('matches scipy exact and asymptotic reference values', () => {
    expect(mannWhitney([1, 2, 3], [4, 5, 6]).pValue).toBeCloseTo(0.1, 12);
    expect(mannWhitney([12.1, 9.8, 14.3, 10.2, 11.7, 13.9, 8.8], [15.2, 16.1, 12.9, 17.4, 14.8, 13.1, 18.0, 15.5]).pValue).toBeCloseTo(0.0037296037296037296, 12);
    expect(mannWhitney([150, 152, 152, 155, 156, 158, 158, 160, 161, 163], [152, 155, 157, 158, 160, 162, 163, 163, 165, 168, 170]).pValue).toBeCloseTo(0.06084581516490868, 6);
  });
});

describe('analyzeOnsetShift', () => {
  it('recovers an injected 12-day later-onset shift', () => {
    const yearly = Array.from({ length: 20 }, (_, i) => ({
      year: 2000 + i,
      value: 150 + (i % 3) + (i >= 10 ? 12 : 0),
    }));
    const result = analyzeOnsetShift(yearly, { splitYear: 2010 });
    expect(result.shiftDays).toBe(12);
    expect(result.verdict).toBe('later_onset');
    expect(result.test.pValue).toBeLessThan(0.05);
  });

  it('reports missing periods honestly', () => {
    expect(analyzeOnsetShift([{ year: 2020, value: 150 }], { splitYear: 2021 }).verdict).toBe('insufficient_data');
  });
});

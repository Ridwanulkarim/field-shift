import { describe, it, expect } from 'vitest';
import { detectEdges, matchEdges, compareGroupings } from '../src/geo/gridProbe.js';

const line = (signatures, start = 24.0, step = 0.05) => signatures.map((signature, i) => ({ pos: Math.round((start + i * step) * 1e6) / 1e6, signature }));

describe('detectEdges', () => {
  it('finds no edge when every sample is identical', () => {
    expect(detectEdges(line(['a', 'a', 'a']))).toEqual([]);
  });
  it('places an edge between the two samples whose data differ', () => {
    const edges = detectEdges(line(['a', 'a', 'b', 'b']));
    expect(edges).toHaveLength(1);
    expect(edges[0].between).toEqual([24.05, 24.1]);
    expect(edges[0].estimate).toBeCloseTo(24.075, 6);
  });
  it('finds several edges', () => {
    expect(detectEdges(line(['a', 'b', 'b', 'c']))).toHaveLength(2);
  });
});

describe('matchEdges', () => {
  const found = (...estimates) => estimates.map((estimate) => ({ estimate }));
  it('accepts edges within the tolerance', () => {
    const r = matchEdges(found(24.26, 24.74), [24.25, 24.75], 0.05);
    expect(r.ok).toBe(true);
    expect(r.matched).toHaveLength(2);
  });
  it('reports an expected edge that was not found', () => {
    const r = matchEdges(found(24.26), [24.25, 24.75], 0.05);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([24.75]);
  });
  it('reports an unexpected edge, and an edge in the wrong place counts as both missing and unexpected', () => {
    const r = matchEdges(found(24.25, 24.5), [24.25], 0.05);
    expect(r.ok).toBe(false);
    expect(r.unexpected).toEqual([24.5]);
    const wrong = matchEdges(found(24.4), [24.25], 0.05);
    expect(wrong.missing).toEqual([24.25]);
    expect(wrong.unexpected).toEqual([24.4]);
  });
});

describe('compareGroupings', () => {
  it('is consistent when same-cell districts share data and different-cell districts do not', () => {
    const r = compareGroupings([
      { slug: 'jashore', cellKey: '46:431', fingerprint: 'x' },
      { slug: 'khulna', cellKey: '46:431', fingerprint: 'x' },
      { slug: 'dhaka', cellKey: '48:433', fingerprint: 'y' },
    ]);
    expect(r.consistent).toBe(true);
  });
  it('flags districts in one cell whose data differ', () => {
    const r = compareGroupings([
      { slug: 'jashore', cellKey: '46:431', fingerprint: 'x' },
      { slug: 'khulna', cellKey: '46:431', fingerprint: 'z' },
    ]);
    expect(r.consistent).toBe(false);
    expect(r.sameCellDifferentData).toEqual([['jashore', 'khulna']]);
  });
  it('flags identical data in different cells (the real grid is coarser than assumed)', () => {
    const r = compareGroupings([
      { slug: 'dhaka', cellKey: '48:433', fingerprint: 'y' },
      { slug: 'cumilla', cellKey: '47:434', fingerprint: 'y' },
    ]);
    expect(r.consistent).toBe(false);
    expect(r.sameDataDifferentCell).toEqual([['dhaka', 'cumilla']]);
  });
});

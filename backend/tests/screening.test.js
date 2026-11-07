import { describe, it, expect } from 'vitest';
import { holmAdjust, summarizeScreen, screenRow } from '../src/science/screening.js';

describe('holmAdjust', () => {
  it('matches a hand-worked example', () => {
    // sorted: 0.005 x4 = 0.02 ; 0.01 x3 = 0.03 ; 0.03 x2 = 0.06 ; 0.04 x1 = 0.04 -> kept monotone: 0.06
    const adj = holmAdjust([0.01, 0.04, 0.03, 0.005]);
    expect(adj[3]).toBeCloseTo(0.02, 10);
    expect(adj[0]).toBeCloseTo(0.03, 10);
    expect(adj[2]).toBeCloseTo(0.06, 10);
    expect(adj[1]).toBeCloseTo(0.06, 10);
  });
  it('caps at 1, skips missing values and keeps their positions', () => {
    expect(holmAdjust([0.9, null, 0.8])).toEqual([1, null, 1]);
    expect(holmAdjust([])).toEqual([]);
    expect(holmAdjust([0.5])).toEqual([0.5]);
  });
  it('never gives an adjusted value below the raw one', () => {
    const p = [0.001, 0.2, 0.04, 0.5, 0.012];
    holmAdjust(p).forEach((a, i) => expect(a).toBeGreaterThanOrEqual(p[i]));
  });
});

const row = (o) => ({ district: 'd', crop: 'aman', runId: 1, sharedWith: [], action: 'none', confidence: 'none', shiftDays: 0, pValue: 0.5, ...o });

describe('summarizeScreen', () => {
  it('counts a significant row that does not survive correction as possibly chance', () => {
    const rows = [row({ district: 'a', runId: 1, pValue: 0.04, action: 'delay', confidence: 'supported', shiftDays: 9 }),
      ...Array.from({ length: 9 }, (_, i) => row({ district: `x${i}`, runId: 10 + i, pValue: 0.6 }))];
    const r = summarizeScreen(rows);
    expect(r.familySize).toBe(10);
    expect(r.rawSignificant).toBe(1);
    expect(r.survivingCorrection).toBe(0);
    expect(r.rows.find((x) => x.district === 'a').verdict).toBe('supported_but_may_be_chance');
    expect(r.expectedFalseAlarmsIfNoRealChange).toBe(0.5);
  });
  it('keeps a strong supported row after correction', () => {
    const rows = [row({ district: 'a', runId: 1, pValue: 0.0001, action: 'delay', confidence: 'supported', shiftDays: 11 }), row({ district: 'b', runId: 2 })];
    expect(summarizeScreen(rows).rows[0].verdict).toBe('supported_after_correction');
  });
  it('counts districts that share stored data once', () => {
    const r = summarizeScreen([row({ district: 'a', runId: 5 }), row({ district: 'b', runId: 5 })]);
    expect(r.familySize).toBe(1);
    expect(r.rows[1].verdict).toBe('same_data_as_another_row');
    expect(r.rows[1].sameDataAs).toBe('a/aman');
  });
  it('lists districts without data and rows without a test, and keeps them out of the family', () => {
    const r = summarizeScreen([{ district: 'z', crop: 'aman', notIngested: true }, row({ district: 'q', pValue: null }), row({ district: 'k' })]);
    expect(r.familySize).toBe(1);
    expect(r.rows.map((x) => x.verdict)).toEqual(['not_ingested', 'not_enough_data', 'no_distinguishable_shift']);
  });
  it('labels a weak result as not reliable', () => {
    expect(summarizeScreen([row({ confidence: 'weak' })]).rows[0].verdict).toBe('weak_not_reliable');
  });
  it('always states the multiple-testing caveat', () => {
    expect(summarizeScreen([row({})]).caveats.join(' ')).toMatch(/by chance/);
  });
});

describe('screenRow', () => {
  it('flattens an advisory response', () => {
    const adv = {
      district: { slug: 'rajshahi', sharedGridCellWith: [] }, crop: { slug: 'aman' }, provenance: { runId: 85 }, latestObservationDate: '2026-10-28',
      decision: { action: 'none', confidence: 'none', shiftDays: 0 },
      evidence: { periods: { early: { years: 12 }, late: { years: 14 } }, excludedYears: [], onsetDates: { earlyMedian: '06-03', lateMedian: '06-04' },
        strength: { pValue: 0.8737, definitionsAgreeing: 15, definitionsUsable: 15, shiftEstimate: { estimateDays: 0, interval95Days: [-8, 7] }, startBoundary: { saturated: false, earlyShareAtFirstDay: 0.4167, lateShareAtFirstDay: 0.3571 } } },
    };
    expect(screenRow(adv)).toMatchObject({ district: 'rajshahi', crop: 'aman', runId: 85, pValue: 0.8737, interval95Days: [-8, 7], earlyAtStartShare: 0.4167, earlyYears: 12, lateYears: 14, excludedYears: 0 });
  });
});

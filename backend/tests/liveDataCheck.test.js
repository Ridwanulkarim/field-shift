import { describe, it, expect } from 'vitest';
import { checkLiveData } from '../src/data/liveDataCheck.js';

const now = new Date('2026-11-02T12:00:00Z');
const d = (slug, climateData, latestObservationDate) => ({ slug, climateData, latestObservationDate });

describe('checkLiveData', () => {
  it('passes when every district has recent NASA data', () => {
    const r = checkLiveData([d('a', 'nasa', '2026-10-26'), d('b', 'nasa', '2026-10-25')], { now });
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });
  it('flags synthetic-only and missing districts', () => {
    const r = checkLiveData([d('a', 'synthetic', '2025-12-31'), d('b', 'none', null)], { now });
    expect(r.ok).toBe(false);
    expect(r.rows.map((x) => x.state)).toEqual(['synthetic_only', 'no_data']);
  });
  it('flags stale NASA data beyond the allowed age', () => {
    const r = checkLiveData([d('a', 'nasa', '2026-09-01')], { now, maxAgeDays: 21 });
    expect(r.ok).toBe(false);
    expect(r.rows[0].state).toBe('stale');
  });
  it('fails when there are no districts at all', () => {
    expect(checkLiveData([], { now }).ok).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { applyCropSources, buildOverlay, UNVERIFIED, VERIFIED, PARTIALLY_VERIFIED } from '../src/science/cropSources.js';
import { CROPS, BASE_CROPS } from '../src/data/reference/crops.js';
import { TRAITS } from '../src/science/cropSheet.js';

// FIXTURE crop and citation: invented to exercise the merge, not real agronomy.
const base = [{ slug: 'x', startMonth: 7, endMonth: 12, waterNeedMmMin: 900, waterNeedMmMax: 1500, heatThresholdC: 35, heatSensitivity: 3, salinityTolerance: 2, waterloggingTolerance: 3, inputIntensity: 3 }];
const cite = { title: 'Fixture', organisation: 'Fixture Org', yearOrEdition: '2020', pageOrTable: 'T3', appliesTo: 'fixture', reviewer: 'R', reviewDate: '2026-11-01', url: null, notes: null };
const entry = (trait, value, citation = cite) => ({ slug: 'x', trait, value, citation });

describe('applyCropSources', () => {
  it('leaves everything UNVERIFIED with an empty overlay', () => {
    const [c] = applyCropSources(base, { approved: [] });
    expect(c.basis).toBe(UNVERIFIED);
    expect(c.startMonth).toBe(7);
    expect(Object.values(c.traitSources).every((s) => s.basis === UNVERIFIED)).toBe(true);
    expect(Object.keys(c.traitSources)).toHaveLength(Object.keys(TRAITS).length);
  });
  it('replaces only the approved trait, attaches its citation, and marks the crop partially verified', () => {
    const [c] = applyCropSources(base, { approved: [entry('startMonth', 6)] });
    expect(c.startMonth).toBe(6);
    expect(c.endMonth).toBe(12);
    expect(c.traitSources.startMonth).toEqual({ basis: VERIFIED, citation: cite });
    expect(c.traitSources.endMonth.basis).toBe(UNVERIFIED);
    expect(c.basis).toBe(PARTIALLY_VERIFIED);
  });
  it('is VERIFIED only when every trait is', () => {
    const all = Object.keys(TRAITS).map((t) => entry(t, base[0][t]));
    expect(applyCropSources(base, { approved: all })[0].basis).toBe(VERIFIED);
  });
  it('does not mutate its input', () => {
    const copy = JSON.parse(JSON.stringify(base));
    applyCropSources(base, { approved: [entry('startMonth', 6)] });
    expect(base).toEqual(copy);
  });
  it('refuses a hand-edited overlay with bad entries', () => {
    expect(() => applyCropSources(base, { approved: [entry('startMonth', 13)] })).toThrow(/between 1 and 12/);
    expect(() => applyCropSources(base, { approved: [{ ...entry('startMonth', 6), slug: 'nope' }] })).toThrow(/unknown crop/);
    expect(() => applyCropSources(base, { approved: [entry('colour', 6)] })).toThrow(/unknown trait/);
    expect(() => applyCropSources(base, { approved: [entry('startMonth', 6), entry('startMonth', 7)] })).toThrow(/duplicate/);
    expect(() => applyCropSources(base, { approved: [entry('startMonth', 6, { ...cite, reviewer: '' })] })).toThrow(/reviewer/);
    expect(() => applyCropSources(base, { approved: [{ slug: 'x', trait: 'startMonth', value: 6 }] })).toThrow(/citation/);
  });
});

describe('buildOverlay', () => {
  it('is sorted and reproducible', () => {
    const rows = [{ slug: 'b', trait: 'startMonth', value: 1, citation: cite }, { slug: 'a', trait: 'endMonth', value: 2, citation: cite }];
    const o = buildOverlay(rows, { sheetName: 's.csv' });
    expect(o.approved.map((r) => r.slug)).toEqual(['a', 'b']);
    expect(JSON.stringify(buildOverlay([...rows].reverse(), { sheetName: 's.csv' }))).toBe(JSON.stringify(o));
  });
});

describe('the shipped crop table', () => {
  it('keeps the original values and labels while no value has been verified', () => {
    expect(CROPS).toHaveLength(12);
    for (const c of CROPS) {
      expect(c.basis).toBe(UNVERIFIED);
      const b = BASE_CROPS.find((x) => x.slug === c.slug);
      for (const t of Object.keys(TRAITS)) expect(c[t]).toBe(b[t]);
    }
  });
});

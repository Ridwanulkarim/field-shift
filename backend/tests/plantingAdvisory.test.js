// Unit tests for the advisory sentence builder and the planting-window request validation.
// Inputs are hand-made decision objects, not NASA results.

import { describe, it, expect } from 'vitest';
import { buildAdvisory, advisoryKind, toBnDigits } from '../src/science/plantingAdvisory.js';
import { parsePlantingWindowRequest } from '../src/validation/plantingWindowRequest.js';

const base = {
  districtEn: 'Rajshahi',
  districtBn: 'রাজশাহী',
  cropEn: 'Aman rice',
  cropBn: 'আমন ধান',
  periods: { early: { from: 2001, to: 2012 }, late: { from: 2013, to: 2025 } },
};
const rec = (over) => ({ action: 'none', shiftDays: null, confidence: 'none', reason: 'no_distinguishable_shift', ...over });

describe('toBnDigits', () => {
  it('converts every digit and leaves other characters alone', () => {
    expect(toBnDigits(2013)).toBe('২০১৩');
    expect(toBnDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
    expect(toBnDigits('2001–2012')).toBe('২০০১–২০১২');
  });
});

describe('advisoryKind', () => {
  it('maps every decision to one kind', () => {
    expect(advisoryKind(rec({ action: 'delay', shiftDays: 5, reason: 'later_onset' }))).toBe('delay');
    expect(advisoryKind(rec({ action: 'advance', shiftDays: 5, reason: 'earlier_onset' }))).toBe('advance');
    expect(advisoryKind(rec({ reason: 'no_distinguishable_shift' }))).toBe('no_change');
    expect(advisoryKind(rec({ reason: 'sensitive_to_definition', confidence: 'weak' }))).toBe('weak');
    expect(advisoryKind(rec({ reason: 'insufficient_data' }))).toBe('insufficient_data');
    expect(advisoryKind(rec({ reason: 'onset_not_applicable', confidence: 'not_applicable' }))).toBe('not_applicable');
  });
  it('rejects an unknown reason instead of guessing', () => {
    expect(() => advisoryKind(rec({ reason: 'surprise' }))).toThrow(/Unknown recommendation reason/);
  });
});

describe('buildAdvisory', () => {
  it('states a delay with the computed days and both periods, in English and Bangla', () => {
    const a = buildAdvisory({ ...base, recommendation: rec({ action: 'delay', shiftDays: 11, confidence: 'supported', reason: 'later_onset' }) });
    expect(a.kind).toBe('delay');
    expect(a.en).toContain('about 11 days later in 2013–2025 than in 2001–2012');
    expect(a.en).toContain('extension officer');
    expect(a.bn).toContain('১১ দিন');
    expect(a.bn).toContain('২০১৩');
    expect(a.bn).toContain('রাজশাহী');
    expect(a.reviewStatus).toBe('BANGLA_DRAFT_NOT_NATIVE_REVIEWED');
  });
  it('states an advance, and uses the day count it was given', () => {
    const a = buildAdvisory({ ...base, recommendation: rec({ action: 'advance', shiftDays: 18, confidence: 'supported', reason: 'earlier_onset' }) });
    expect(a.kind).toBe('advance');
    expect(a.en).toContain('about 18 days earlier');
    expect(a.bn).toContain('১৮');
  });
  it('says there is no change without claiming any number of days', () => {
    const a = buildAdvisory({ ...base, recommendation: rec({ shiftDays: 0 }) });
    expect(a.kind).toBe('no_change');
    expect(a.en).not.toMatch(/\b\d+ days\b/);
    expect(a.en).toMatch(/Nothing here suggests changing/);
  });
  it('says a definition-dependent result does not support changing planting, with no day count', () => {
    const a = buildAdvisory({ ...base, recommendation: rec({ reason: 'sensitive_to_definition', confidence: 'weak' }) });
    expect(a.kind).toBe('weak');
    expect(a.en).not.toMatch(/\d/);
    expect(a.en).toMatch(/does not support changing/);
  });
  it('says so plainly for insufficient data and for crops without a definition', () => {
    const insufficient = buildAdvisory({ ...base, recommendation: rec({ reason: 'insufficient_data' }) });
    expect(insufficient.en).toMatch(/not enough years/);
    const na = buildAdvisory({ ...base, cropEn: 'Boro rice', cropBn: 'বোরো ধান', recommendation: rec({ reason: 'onset_not_applicable', confidence: 'not_applicable' }) });
    expect(na.en).toMatch(/no rainfall-onset advice/);
    expect(na.bn).toContain('বোরো ধান');
  });
});

describe('parsePlantingWindowRequest', () => {
  const now = new Date('2026-11-03T00:00:00Z');
  it('accepts a crop and defaults split to null', () => {
    expect(parsePlantingWindowRequest({ crop: 'aman' }, { now })).toEqual({ crop: 'aman', splitYear: null });
  });
  it('accepts a valid split year', () => {
    expect(parsePlantingWindowRequest({ crop: 'sweet-potato', split: '2013' }, { now })).toEqual({ crop: 'sweet-potato', splitYear: 2013 });
  });
  const bad = (query) => {
    try {
      parsePlantingWindowRequest(query, { now });
    } catch (err) {
      return err;
    }
    return null;
  };
  it('rejects a missing, upper-case, path-like or repeated crop', () => {
    for (const crop of [undefined, 'Aman', '../etc', 'aman rice', '', ['aman', 'boro']]) {
      const err = bad({ crop });
      expect(err?.status).toBe(422);
      expect(err.details[0].field).toBe('crop');
    }
  });
  it('rejects a split that is not a plausible four-digit year', () => {
    for (const split of ['abc', '13', '1800', '2027', '2013.5', '-2013']) {
      const err = bad({ crop: 'aman', split });
      expect(err?.status).toBe(422);
      expect(err.details[0].field).toBe('split');
    }
  });
  it('rejects unknown parameters and reports every problem at once', () => {
    const err = bad({ foo: '1', split: 'x' });
    expect(err.details.map((d) => d.field).sort()).toEqual(['crop', 'foo', 'split']);
  });
});
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../src/science/csv.js';
import { validateCropSheet, checkTraitValue, SHEET_COLUMNS } from '../src/science/cropSheet.js';
import { BASE_CROPS as CROPS } from '../src/data/reference/crops.js';

// FIXTURE rows: invented only to exercise the rules. They say nothing about real crops.
const crops = [{ slug: 'rice-aman', startMonth: 7, endMonth: 12, waterNeedMmMin: 900, waterNeedMmMax: 1500 }];
const TODAY = '2026-11-07';
const GOOD = {
  verified_value: '7', status: 'verified', source_title: 'Fixture Handbook', source_organisation: 'Fixture Institute',
  source_year_or_edition: '2020', source_url: 'https://example.org/h', page_or_table: 'Table 3', region_or_variety_it_applies_to: 'Fixture region',
  reviewer: 'Reviewer One', review_date: '2026-11-01', notes: '',
};
function sheet(rows) {
  const line = (r) => SHEET_COLUMNS.map((c) => `"${String(r[c] ?? '').replaceAll('"', '""')}"`).join(',');
  const base = (trait, cur) => ({ crop_slug: 'rice-aman', crop_name_en: 'Aman', trait, current_value_UNVERIFIED: cur, status: 'unverified' });
  const all = [base('startMonth', 7), base('endMonth', 12), base('waterNeedMmMin', 900), base('waterNeedMmMax', 1500)]
    .map((b) => rows.find((r) => r.trait === b.trait) ? { ...b, ...rows.find((r) => r.trait === b.trait) } : b);
  return [SHEET_COLUMNS.join(','), ...all.map(line)].join('\n');
}
const run = (rows) => validateCropSheet(sheet(rows), { crops, today: TODAY });

describe('csv parser', () => {
  it('handles quotes, commas, escaped quotes, newlines in fields, CRLF and BOM', () => {
    expect(parse('﻿a,b\r\n"x,1","he said ""hi"""\r\n"l1\nl2",z')).toEqual([['a', 'b'], ['x,1', 'he said "hi"'], ['l1\nl2', 'z']]);
  });
  it('throws on an unterminated quote', () => {
    expect(() => parse('a,"b')).toThrow(/never closed/);
  });
});

describe('checkTraitValue', () => {
  it('accepts in-range values and rejects ranges, decimals for integer traits, and non-numbers', () => {
    expect(checkTraitValue('startMonth', '7')).toEqual({ ok: true, value: 7 });
    expect(checkTraitValue('startMonth', '13').ok).toBe(false);
    expect(checkTraitValue('startMonth', '0').ok).toBe(false);
    expect(checkTraitValue('startMonth', '6.5').ok).toBe(false);
    expect(checkTraitValue('waterNeedMmMin', '1200 mm').ok).toBe(false);
    expect(checkTraitValue('waterNeedMmMin', '1200.5').ok).toBe(true);
    expect(checkTraitValue('heatSensitivity', '6').ok).toBe(false);
    expect(checkTraitValue('nope', '1').ok).toBe(false);
  });
});

describe('validateCropSheet', () => {
  it('approves a fully evidenced verified row and records its citation', () => {
    const r = run([{ trait: 'startMonth', ...GOOD }]);
    expect(r.ok).toBe(true);
    expect(r.approved).toHaveLength(1);
    expect(r.approved[0]).toMatchObject({ slug: 'rice-aman', trait: 'startMonth', value: 7, replaces: 7 });
    expect(r.approved[0].citation).toMatchObject({ organisation: 'Fixture Institute', pageOrTable: 'Table 3', reviewer: 'Reviewer One' });
  });
  it('rejects verified rows that lack any required evidence', () => {
    for (const field of ['source_title', 'source_organisation', 'source_year_or_edition', 'page_or_table', 'region_or_variety_it_applies_to', 'reviewer', 'review_date', 'verified_value']) {
      const r = run([{ trait: 'startMonth', ...GOOD, [field]: '' }]);
      expect(r.ok, field).toBe(false);
      expect(r.approved, field).toHaveLength(0);
    }
  });
  it('rejects out-of-range values, bad dates, future dates and bad URLs', () => {
    expect(run([{ trait: 'startMonth', ...GOOD, verified_value: '13' }]).ok).toBe(false);
    expect(run([{ trait: 'startMonth', ...GOOD, review_date: '2026-02-30' }]).ok).toBe(false);
    expect(run([{ trait: 'startMonth', ...GOOD, review_date: '2027-01-01' }]).ok).toBe(false);
    expect(run([{ trait: 'startMonth', ...GOOD, source_url: 'ftp://x' }]).ok).toBe(false);
  });
  it('never accepts an AI assistant as source or reviewer', () => {
    expect(run([{ trait: 'startMonth', ...GOOD, reviewer: 'ChatGPT' }]).approved).toHaveLength(0);
    expect(run([{ trait: 'startMonth', ...GOOD, source_organisation: 'Claude (Anthropic)' }]).ok).toBe(false);
  });
  it('rejects a value filled in on an unverified or no_source_found row', () => {
    expect(run([{ trait: 'startMonth', verified_value: '7', status: 'unverified' }]).ok).toBe(false);
    expect(run([{ trait: 'startMonth', verified_value: '7', status: 'no_source_found' }]).ok).toBe(false);
  });
  it('requires notes on a disputed row and never approves it', () => {
    expect(run([{ trait: 'startMonth', status: 'disputed' }]).ok).toBe(false);
    const r = run([{ trait: 'startMonth', status: 'disputed', notes: 'A says 7 (BRRI p3); B says 8 (DAE p9)' }]);
    expect(r.ok).toBe(true);
    expect(r.approved).toHaveLength(0);
  });
  it('rejects unknown crops, unknown traits, bad status, duplicates', () => {
    expect(run([{ trait: 'startMonth', crop_slug: 'x', ...GOOD }]).ok).toBe(false);
    expect(run([{ trait: 'startMonth', status: 'maybe' }]).ok).toBe(false);
    const dup = sheet([]) + '\n' + sheet([]).split('\n')[1];
    expect(validateCropSheet(dup, { crops, today: TODAY }).errors.some((e) => /Duplicate/.test(e.message))).toBe(true);
  });
  it('flags min > max water need and warns on a lone water bound', () => {
    const both = run([{ trait: 'waterNeedMmMin', ...GOOD, verified_value: '1600' }, { trait: 'waterNeedMmMax', ...GOOD, verified_value: '1400' }]);
    expect(both.errors.some((e) => /greater than/.test(e.message))).toBe(true);
    const lone = run([{ trait: 'waterNeedMmMin', ...GOOD, verified_value: '1000' }]);
    expect(lone.ok).toBe(true);
    expect(lone.warnings.some((w) => /Only one of/.test(w.message))).toBe(true);
  });
  it('warns when current_value_UNVERIFIED no longer matches the code', () => {
    const r = run([{ trait: 'startMonth', current_value_UNVERIFIED: '9' }]);
    expect(r.warnings.some((w) => /Do not edit that column/.test(w.message))).toBe(true);
  });
  it('rejects missing columns and malformed CSV without throwing', () => {
    expect(validateCropSheet('crop_slug,trait\nx,y', { crops }).ok).toBe(false);
    expect(validateCropSheet('a,"b', { crops }).ok).toBe(false);
  });
});

describe('the real template', () => {
  it('matches the code: 12 crops x 9 traits, all unverified, no errors, no approvals', () => {
    const text = readFileSync(join(import.meta.dirname, '../../docs/templates/crop-traits-sourcing.csv'), 'utf8');
    const r = validateCropSheet(text, { crops: CROPS });
    expect(r.errors).toEqual([]);
    expect(r.summary.rows).toBe(108);
    expect(r.summary.byStatus.unverified).toBe(108);
    expect(r.approved).toHaveLength(0);
    expect(r.warnings).toEqual([]);
  });
});

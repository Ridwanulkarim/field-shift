import { describe, it, expect } from 'vitest';
import { buildBanglaReviewRows, toCsv, REVIEW_COLUMNS } from '../src/services/banglaReview.js';
import { parse } from '../src/science/csv.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';

describe('Bangla review sheet', () => {
  it('has one row per sentence kind, name and label, with unique ids and no empty text', async () => {
    const rows = await buildBanglaReviewRows();
    const count = (g) => rows.filter((r) => r.group === g).length;
    expect(count('advisory')).toBe(7);
    expect(count('farmer_sentence')).toBe(5);
    expect(count('field_summary')).toBe(2);
    expect(count('district_name')).toBe(DISTRICTS.length);
    expect(count('crop_name')).toBe(CROPS.length);
    expect(count('priority_label')).toBe(5);
    expect(count('month_name')).toBe(12);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.english.trim(), r.id).not.toBe('');
      expect(r.bangla_draft.trim(), r.id).not.toBe('');
      expect(r.verdict).toBe('');
    }
  });
  it('writes Bangla digits only in the sentences, and covers the window, interval and May-source texts', async () => {
    const rows = await buildBanglaReviewRows();
    for (const r of rows.filter((x) => ['advisory', 'farmer_sentence', 'field_summary', 'month_name'].includes(x.group))) {
      expect(r.bangla_draft.replace(/NASA POWER/g, ''), r.id).not.toMatch(/[0-9]/);
    }
    const all = rows.map((r) => r.bangla_draft).join(' ');
    expect(all).toMatch(/আপনার চিরাচরিত রোপণের সময় যদি/);
    expect(all).toMatch(/বাদ দেওয়া যায় না/);
    expect(all).toMatch(/স্বাধীন উৎস/);
  });
  it('is deterministic', async () => {
    expect(await buildBanglaReviewRows()).toEqual(await buildBanglaReviewRows());
  });
  it('writes a CSV with a byte-order mark that reads back to the same rows', async () => {
    const rows = await buildBanglaReviewRows();
    const csv = toCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    const table = parse(csv);
    expect(table[0]).toEqual([...REVIEW_COLUMNS]);
    expect(table.length - 1).toBe(rows.length);
    const bn = table.slice(1).map((r) => r[REVIEW_COLUMNS.indexOf('bangla_draft')]);
    expect(bn).toEqual(rows.map((r) => r.bangla_draft));
    for (const row of table.slice(1)) expect(row).toHaveLength(REVIEW_COLUMNS.length);
  });
});

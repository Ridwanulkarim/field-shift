import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildChirpsFile, validateChirpsFile, writeChirpsFile, loadChirpsFile } from '../src/data/chirpsStore.js';

const district = { slug: 'rajshahi', nameEn: 'Rajshahi', latitude: 24.37, longitude: 88.6 };
const series = [{ date: '2001-01-01', precipMm: 0 }, { date: '2001-01-02', precipMm: 1.5 }, { date: '2001-01-03', precipMm: null }];
const prov = { source: 'FIXTURE for tests', isSynthetic: false };
const make = () => buildChirpsFile({ district, provenance: prov, series });

describe('CHIRPS files', () => {
  it('round-trips through disk and loads as a daily series with nulls kept', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chirps-'));
    writeChirpsFile(make(), dir);
    const { series: loaded } = loadChirpsFile('rajshahi', dir);
    expect(loaded.map((r) => r.precipMm)).toEqual([0, 1.5, null]);
  });
  it('accepts a good file', () => {
    expect(validateChirpsFile(make(), 'rajshahi')).toEqual([]);
  });
  it('refuses a file edited by hand, a gap, a wrong district, a synthetic flag and bad values', () => {
    const edited = make(); edited.rows[1][1] = 99;
    expect(validateChirpsFile(edited, 'rajshahi').join()).toMatch(/sha256/);
    const gap = buildChirpsFile({ district, provenance: prov, series: [series[0], { date: '2001-01-03', precipMm: 1 }] });
    expect(validateChirpsFile(gap, 'rajshahi').join()).toMatch(/clean daily/);
    expect(validateChirpsFile(make(), 'dhaka').join()).toMatch(/expected dhaka/);
    expect(validateChirpsFile(buildChirpsFile({ district, provenance: { ...prov, isSynthetic: true }, series }), 'rajshahi').join()).toMatch(/isSynthetic/);
    expect(validateChirpsFile(buildChirpsFile({ district, provenance: prov, series: [{ date: '2001-01-01', precipMm: -5 }] }), 'rajshahi').join()).toMatch(/bad value/);
  });
  it('says how to create a missing file', () => {
    expect(() => loadChirpsFile('rajshahi', fs.mkdtempSync(path.join(os.tmpdir(), 'chirps-')))).toThrow(/npm run fetch:chirps/);
  });
});

import { createCrossCheckProvider } from '../src/data/chirpsStore.js';

describe('cross-check provider', () => {
  const report = {
    comparedRange: { first: '2001-01-01', last: '2025-12-31' }, chirpsRetrievedAt: 't', chirpsSha256: 'x',
    crops: { aman: { verdicts: { sameVerdict: false, a: { verdict: 'later_onset', shiftDays: 10 }, b: { verdict: 'no_distinguishable_shift', shiftDays: 1 } },
      summary: { yearsCompared: 25, medianAbsDiffDays: 4, within7DaysShare: 0.7, correlation: 0.5 }, firstDayShare: { power: 0.1, chirps: 0.1 } } },
  };
  const dirWith = (name, content) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')); if (content !== undefined) fs.writeFileSync(path.join(d, name), content); return d; };

  it('returns the summary for a compared crop and null otherwise', () => {
    const provider = createCrossCheckProvider(dirWith('compare-rajshahi.json', JSON.stringify(report)));
    expect(provider('rajshahi', 'aman')).toMatchObject({ sameVerdict: false });
    expect(provider('rajshahi', 'aus')).toBeNull();
    expect(provider('dhaka', 'aman')).toBeNull();
  });
  it('ignores a malformed or unreadable report with one warning, never guessing', () => {
    const warnings = [];
    const provider = createCrossCheckProvider(dirWith('compare-rajshahi.json', '{"crops":{"aman":{}}}'), { warn: (m) => warnings.push(m) });
    expect(provider('rajshahi', 'aman')).toBeNull();
    expect(provider('rajshahi', 'aman')).toBeNull();
    expect(warnings).toHaveLength(1);
    const broken = createCrossCheckProvider(dirWith('compare-rajshahi.json', 'not json'), { warn: () => {} });
    expect(broken('rajshahi', 'aman')).toBeNull();
  });
});

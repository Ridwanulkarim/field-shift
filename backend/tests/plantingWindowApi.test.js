// API tests for GET /api/districts/:slug/planting-window.
// The repository is a FAKE with hand-built climate fixtures, and the "NASA POWER" label below is a
// test label only. None of these numbers is a NASA observation.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';

// Rain starts 10-13 June in 2001-2012 and 27-30 June in 2013-2025, then falls 10 mm a day through August.
// Hand calculation (see plantingWindow.test.js): the onset shifts 16.5 days later, recommended as 17.
function shiftedSeries() {
  return buildSeries(2001, 2025, (y, m, d) => {
    const startDay = y < 2013 ? 10 + (y % 4) : 27 + (y % 4);
    const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
    return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
  });
}

// Same onset every year: nothing to detect.
function unchangedSeries() {
  return buildSeries(2001, 2025, (y, m, d) => {
    const startDay = 10 + (y % 4);
    const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
    return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
  });
}

function fakeRepository({ climate = 'real', series = shiftedSeries() } = {}) {
  const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
  return {
    ping: async () => true,
    listDistricts: async () => districts,
    getDistrictBySlug: async (slug) => districts.find((d) => d.slug === slug) ?? null,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
    getClimate: async () =>
      climate === 'none'
        ? null
        : {
            provenance: {
              runId: 7,
              source: climate === 'synthetic' ? 'SYNTHETIC' : 'NASA POWER',
              isSynthetic: climate === 'synthetic',
              retrievedAt: '2026-11-02T16:55:22.041Z',
              startDate: '2001-01-01',
              endDate: '2025-12-31',
              units: { PRECTOTCORR: 'mm/day', T2M_MAX: 'C', T2M_MIN: 'C' },
            },
            series,
          },
  };
}

const appWith = (opts) => createApp(loadConfig({}), { repository: fakeRepository(opts) });
const URL = (query = 'crop=aman') => `/api/districts/rajshahi/planting-window?${query}`;

describe('GET /api/districts/:slug/planting-window', () => {
  const app = appWith();

  it('returns a supported delay with evidence, provenance and an English and Bangla advisory', async () => {
    const res = await request(app).get(URL());
    expect(res.status).toBe(200);
    expect(res.body.recommendation).toEqual({ action: 'delay', shiftDays: 17, confidence: 'supported', reason: 'later_onset' });
    expect(res.body.onset.definition.startMonth).toBe(6); // Aman: search starts 1 June
    expect(res.body.onset.analysis.shiftDays).toBe(16.5);
    expect(res.body.onset.yearly).toHaveLength(25);
    expect(res.body.periods).toEqual({
      splitYear: 2013,
      early: { from: 2001, to: 2012, years: 12 },
      late: { from: 2013, to: 2025, years: 13 },
    });
    expect(res.body.advisory.kind).toBe('delay');
    expect(res.body.advisory.en).toContain('about 17 days later in 2013–2025 than in 2001–2012');
    expect(res.body.advisory.bn).toContain('১৭ দিন');
    expect(res.body.advisory.reviewStatus).toBe('BANGLA_DRAFT_NOT_NATIVE_REVIEWED');
    expect(res.body.provenance).toMatchObject({ runId: 7, source: 'NASA POWER', isSynthetic: false, dataStatus: 'cached' });
    expect(res.body.dataLabel.kind).toBe('nasa_stored');
    expect(res.body.limitations.length).toBeGreaterThan(0);
    expect(res.body.disclaimer).toMatch(/does not replace/);
    expect(res.body.gdd.yearly.length).toBeGreaterThan(0);
  });

  it('does not expose internal database ids', async () => {
    const res = await request(app).get(URL());
    expect(res.body.district).not.toHaveProperty('id');
    expect(res.body.crop).not.toHaveProperty('id');
  });

  it('honours a custom split year', async () => {
    const res = await request(app).get(URL('crop=aman&split=2010'));
    expect(res.status).toBe(200);
    expect(res.body.periods.splitYear).toBe(2010);
    expect(res.body.periods.early).toMatchObject({ from: 2001, to: 2009 });
    expect(res.body.periods.late).toMatchObject({ from: 2010, to: 2025 });
  });

  it('recommends nothing when the series has no change', async () => {
    const res = await request(appWith({ series: unchangedSeries() })).get(URL());
    expect(res.status).toBe(200);
    expect(res.body.recommendation).toMatchObject({ action: 'none', shiftDays: 0, reason: 'no_distinguishable_shift' });
    expect(res.body.advisory.kind).toBe('no_change');
    expect(res.body.advisory.en).not.toMatch(/\b\d+ days\b/);
  });

  it('gives Boro no rainfall-onset advice but still reports growing degree days', async () => {
    const res = await request(app).get(URL('crop=boro'));
    expect(res.status).toBe(200);
    expect(res.body.onset.applies).toBe(false);
    expect(res.body.onset.analysis).toBeNull();
    expect(res.body.recommendation.confidence).toBe('not_applicable');
    expect(res.body.advisory.kind).toBe('not_applicable');
    expect(res.body.gdd.yearly.length).toBeGreaterThan(0);
  });

  it('sets cache headers and answers 304 for the same run, crop and split', async () => {
    const first = await request(app).get(URL());
    expect(first.headers['cache-control']).toBe('public, max-age=300');
    expect(first.headers.etag).toMatch(/^"[0-9a-f]{64}"$/);
    const again = await request(app).get(URL()).set('If-None-Match', first.headers.etag);
    expect(again.status).toBe(304);
    const other = await request(app).get(URL('crop=boro'));
    expect(other.headers.etag).not.toBe(first.headers.etag);
  });

  it('is deterministic', async () => {
    const a = await request(app).get(URL());
    const b = await request(appWith()).get(URL());
    expect(a.body).toEqual(b.body);
  });
});

describe('planting-window errors', () => {
  const app = appWith();

  it('rejects a missing crop with 422 and a field-level message', async () => {
    const res = await request(app).get(URL(''));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('crop');
  });

  it('rejects an unknown crop with 422', async () => {
    const res = await request(app).get(URL('crop=unicorn'));
    expect(res.status).toBe(422);
    expect(res.body.error.details[0]).toMatchObject({ field: 'crop', message: 'Unknown crop "unicorn".' });
  });

  it('rejects a bad split, a repeated crop and unknown parameters with 422', async () => {
    expect((await request(app).get(URL('crop=aman&split=abc'))).status).toBe(422);
    expect((await request(app).get(URL('crop=aman&split=1800'))).status).toBe(422);
    expect((await request(app).get(URL('crop=aman&crop=boro'))).status).toBe(422);
    expect((await request(app).get(URL('crop=aman&foo=1'))).status).toBe(422);
  });

  it('answers 404 for an unknown district', async () => {
    const res = await request(app).get('/api/districts/atlantis/planting-window?crop=aman');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISTRICT_NOT_FOUND');
  });

  it('refuses to give an advisory from synthetic data', async () => {
    const res = await request(appWith({ climate: 'synthetic' })).get(URL());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_REAL_CLIMATE_DATA');
  });

  it('answers 404 when the district has no climate data at all', async () => {
    const res = await request(appWith({ climate: 'none' })).get(URL());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_REAL_CLIMATE_DATA');
  });

  it('answers 503 without a database instead of pretending', async () => {
    const res = await request(createApp(loadConfig({}))).get(URL());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
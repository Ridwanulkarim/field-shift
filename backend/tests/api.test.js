import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';

// FAKE repository with hand-built climate fixtures. It stands in for the database so the
// API can be tested without one. The "NASA" provenance below is a test label only.
function fakeRepository({ climate = 'real' } = {}) {
  const series = buildSeries(2001, 2020, (y, m) => ({ precipMm: m >= 6 && m <= 10 ? 10 : 0.2, tMaxC: 30 }));
  const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
  return {
    ping: async () => true,
    recentFailedRuns: async () => [{ district: 'rajshahi', source: 'NASA POWER', retrievedAt: '2026-01-01T00:00:00.000Z', errorMessage: 'HTTP 503' }],
    listDistricts: async () => districts.map((d) => ({ ...d, climateData: climate === 'none' ? 'none' : climate === 'synthetic' ? 'synthetic' : 'nasa' })),
    getDistrictBySlug: async (slug) => districts.find((d) => d.slug === slug) ?? null,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
    getClimate: async () =>
      climate === 'none'
        ? null
        : {
            provenance: { runId: 1, source: climate === 'synthetic' ? 'SYNTHETIC' : 'NASA POWER', isSynthetic: climate === 'synthetic', retrievedAt: '2026-01-01T00:00:00.000Z' },
            series,
          },
  };
}

const body = { district: 'rajshahi', existingRotation: ['boro', 'aman'] };
const appWith = (opts) => createApp(loadConfig({}), { repository: fakeRepository(opts) });

describe('data routes without a database', () => {
  const app = createApp(loadConfig({}));
  it('answer 503 instead of pretending', async () => {
    const res = await request(app).get('/api/districts');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect((await request(app).get('/api/health/db')).status).toBe(503);
  });
  it('still serves /api/meta and /api/health', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    const meta = await request(app).get('/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.priorities).toHaveLength(5);
    expect(meta.body.disclaimer).toMatch(/does not replace/);
  });
});

describe('GET /api/health/db and /api/health/data', () => {
  const app = appWith();
  it('reports the database as reachable', async () => {
    const res = await request(app).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('reachable');
  });
  it('reports a database failure as 503 without leaking the cause', async () => {
    const repo = fakeRepository();
    repo.ping = async () => {
      throw new Error('password authentication failed for user secret');
    };
    const res = await request(createApp(loadConfig({}), { repository: repo })).get('/api/health/db');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });
  it('shows data status and recent failures', async () => {
    const res = await request(app).get('/api/health/data');
    expect(res.body.tally.nasa).toBe(DISTRICTS.length);
    expect(res.body.recentFailedRuns[0].errorMessage).toBe('HTTP 503');
  });
});

describe('GET /api/districts, /api/crops, climate', () => {
  const app = appWith();
  it('lists districts with a climate-data flag', async () => {
    const res = await request(app).get('/api/districts');
    expect(res.status).toBe(200);
    expect(res.body.districts[0]).toHaveProperty('climateData');
  });
  it('lists crops without internal ids', async () => {
    const res = await request(app).get('/api/crops');
    expect(res.body.crops).toHaveLength(CROPS.length);
    expect(res.body.crops[0]).not.toHaveProperty('id');
    expect(res.body.crops[0].basis).toBe('UNVERIFIED_GENERAL_KNOWLEDGE');
  });
  it('returns indicators for a district', async () => {
    const res = await request(app).get('/api/districts/rajshahi/climate');
    expect(res.status).toBe(200);
    expect(res.body.climate.status).toBe('available');
    expect(res.body.climate.indicators).toHaveLength(5);
    expect(res.body.climate).not.toHaveProperty('series');
  });
  it('returns validated real daily climate data with provenance', async () => {
    const res = await request(appWith()).get('/api/districts/rajshahi/climate/daily?from=2001-01-01&to=2001-01-03');
    expect(res.status).toBe(200);
    expect(res.body.daily).toHaveLength(3);
    expect(res.body.daily[0]).toEqual(expect.objectContaining({ date: '2001-01-01' }));
    expect(res.body.provenance).toEqual(expect.objectContaining({ source: 'NASA POWER', isSynthetic: false }));
    expect(res.body.provenance.missing).toEqual({ precipMm: 0, tMaxC: 0, tMinC: 3 });
    expect(res.body.dataLabel.kind).toBe('nasa_stored');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });
  it('fills dates outside the stored series and returns 304 for the same run and range', async () => {
    const app = appWith();
    const first = await request(app).get('/api/districts/rajshahi/climate/daily?from=2000-12-31&to=2001-01-02');
    expect(first.body.daily).toEqual([
      { date: '2000-12-31', precipMm: null, tMaxC: null, tMinC: null },
      { date: '2001-01-01', precipMm: 0.2, tMaxC: 30, tMinC: null },
      { date: '2001-01-02', precipMm: 0.2, tMaxC: 30, tMinC: null },
    ]);
    const second = await request(app)
      .get('/api/districts/rajshahi/climate/daily?from=2000-12-31&to=2001-01-02')
      .set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
  });
  it('rejects invalid and overlong daily climate ranges', async () => {
    const app = appWith();
    expect((await request(app).get('/api/districts/rajshahi/climate/daily?from=2001-02-30&to=2001-03-01')).status).toBe(422);
    expect((await request(app).get('/api/districts/rajshahi/climate/daily?from=2002-01-01&to=2001-01-01')).status).toBe(422);
    expect((await request(app).get('/api/districts/rajshahi/climate/daily?from=2001-01-01&to=2007-01-01')).status).toBe(422);
  });
  it('does not fall back to synthetic data for daily climate', async () => {
    const res = await request(appWith({ climate: 'synthetic' })).get('/api/districts/rajshahi/climate/daily?from=2001-01-01&to=2001-01-03');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_REAL_CLIMATE_DATA');
  });
  it('404s for an unknown district', async () => {
    const res = await request(app).get('/api/districts/atlantis/climate');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('DISTRICT_NOT_FOUND');
  });
});

describe('POST /api/evaluate', () => {
  it('returns the existing rotation plus three ranked alternatives', async () => {
    const res = await request(appWith()).post('/api/evaluate').send(body);
    expect(res.status).toBe(200);
    expect(res.body.strategies).toHaveLength(4);
    expect(res.body.strategies[0].kind).toBe('existing');
    expect(res.body.climate.status).toBe('available');
    expect(res.body.climate.notice).toBeNull();
    expect(res.body.disclaimer).toMatch(/does not replace/);
    expect(res.body.limitations.length).toBeGreaterThan(0);
    expect(res.body.method.components.length).toBe(7);
  });

  it('flags synthetic data prominently', async () => {
    const res = await request(appWith({ climate: 'synthetic' })).post('/api/evaluate').send(body);
    expect(res.status).toBe(200);
    expect(res.body.climate.provenance.isSynthetic).toBe(true);
    expect(res.body.climate.notice).toMatch(/SYNTHETIC/);
  });

  it('works without climate data and says so, with no fake numbers', async () => {
    const res = await request(appWith({ climate: 'none' })).post('/api/evaluate').send(body);
    expect(res.status).toBe(200);
    expect(res.body.climate.status).toBe('unavailable');
    expect(res.body.climate.notice).toMatch(/No climate data/);
    const water = res.body.strategies[0].components.find((c) => c.id === 'waterFit');
    expect(water.value).toBeNull();
  });

  it('returns 422 with field details for invalid input', async () => {
    const res = await request(appWith()).post('/api/evaluate').send({ district: 'rajshahi', existingRotation: [], irrigation: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field)).toEqual(['existingRotation', 'irrigation']);
  });

  it('returns 404 for an unknown district', async () => {
    const res = await request(appWith()).post('/api/evaluate').send({ ...body, district: 'atlantis' });
    expect(res.status).toBe(404);
  });

  it('returns 422 for an unknown crop', async () => {
    const res = await request(appWith()).post('/api/evaluate').send({ ...body, existingRotation: ['aman', 'quinoa'] });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toMatch(/quinoa/);
  });

  it('uses a registered field for district and salinity context', async () => {
    const repository = fakeRepository();
    repository.getField = async () => ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Field',
      districtId: 1,
      district: { id: 1, slug: 'rajshahi' },
      areaHa: 2,
      soilType: 'Clay',
      soilPh: 6,
      salinityDsM: 5,
      irrigationSource: 'Canal',
    });
    repository.getFieldGeoContext = async () => FIELD_CTX;
    repository.getClimateByCell = async () => CELL_CLIMATE;
    const res = await request(createApp(loadConfig({}), { repository })).post('/api/evaluate').send({
      ...body,
      fieldId: '550e8400-e29b-41d4-a716-446655440000',
      district: 'rajshahi',
    });
    expect(res.status).toBe(200);
    expect(res.body.field.name).toBe('Test Field');
    expect(res.body.input.soil.salinity).toBe('moderate');
    const mismatch = await request(createApp(loadConfig({}), { repository })).post('/api/evaluate').send({
      ...body,
      district: 'sylhet',
      fieldId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error.details[0].field).toBe('fieldId');
  });

  it('returns 422 when the current rotation cannot fit in one year', async () => {
    const res = await request(appWith()).post('/api/evaluate').send({ ...body, existingRotation: ['boro', 'mustard'] });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toMatch(/cannot share one year/);
  });

  it('returns 400 for broken JSON', async () => {
    const res = await request(appWith()).post('/api/evaluate').set('Content-Type', 'application/json').send('{"district": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });
});

// ---- Field-aware evaluation: climate comes from the field's grid cell, not the district point ----

const FIELD_ID = '550e8400-e29b-41d4-a716-446655440000';
const FIELD_CTX = {
  id: FIELD_ID, name: 'Test Field', areaHa: 2,
  district: { id: 1, slug: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী' },
  point: { lat: 24.37, lon: 88.6 },
  bbox: { minLon: 88.6, maxLon: 88.61, minLat: 24.37, maxLat: 24.38 },
};
const CELL_CLIMATE = {
  provenance: { runId: 9, source: 'NASA POWER', isSynthetic: false, dataStatus: 'cached', retrievedAt: '2026-11-01T00:00:00.000Z', startDate: '2001-01-01', endDate: '2025-12-31' },
  series: buildSeries(2001, 2020, (y, m) => ({ precipMm: m >= 6 && m <= 10 ? 10 : 0.2, tMaxC: 30 })),
};

describe('POST /api/evaluate with a registered field', () => {
  function appWithField({ cellClimate = CELL_CLIMATE, ctx = FIELD_CTX } = {}) {
    const repository = fakeRepository();
    repository.getField = async () => ({
      id: FIELD_ID, name: 'Test Field', districtId: 1, district: { id: 1, slug: 'rajshahi' },
      areaHa: 2, soilType: null, soilPh: null, salinityDsM: null, irrigationSource: null,
    });
    repository.getFieldGeoContext = async () => ctx;
    repository.getClimateByCell = async () => cellClimate;
    return createApp(loadConfig({}), { repository });
  }
  const withField = { ...body, fieldId: FIELD_ID };

  it('uses the climate of the field\'s grid cell (run 9), not the district reference run (run 1)', async () => {
    const res = await request(appWithField()).post('/api/evaluate').send(withField);
    expect(res.status).toBe(200);
    expect(res.body.climate.provenance.runId).toBe(9);
    expect(res.body.climate.scope).toMatchObject({ basis: 'field_grid_cell', spansMultipleCells: false });
    expect(res.body.climate.scope.cell).toMatchObject({ provider: 'NASA POWER', cellKey: '49:430' });
    expect(res.body.limitations.join(' ')).toMatch(/whole NASA POWER grid cell/);
  });

  it('without a field still uses the district run and carries no cell scope', async () => {
    const res = await request(appWith()).post('/api/evaluate').send(body);
    expect(res.status).toBe(200);
    expect(res.body.climate.provenance.runId).toBe(1);
    expect(res.body.climate).not.toHaveProperty('scope');
  });

  it('fails with 404 CLIMATE_CELL_NOT_INGESTED instead of silently using district data', async () => {
    const res = await request(appWithField({ cellClimate: null })).post('/api/evaluate').send(withField);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIMATE_CELL_NOT_INGESTED');
  });

  it('refuses a field whose location cannot be determined', async () => {
    const res = await request(appWithField({ ctx: null })).post('/api/evaluate').send(withField);
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('fieldId');
  });

  it('warns when the field crosses a grid-cell edge', async () => {
    const ctx = { ...FIELD_CTX, spansMultipleCells: true };
    const res = await request(appWithField({ ctx })).post('/api/evaluate').send(withField);
    expect(res.body.climate.scope.spansMultipleCells).toBe(true);
    expect(res.body.limitations.join(' ')).toMatch(/intersects more than one provider grid cell/);
  });
});

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

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createFieldService } from '../src/services/fieldService.js';

const FIELD_ID = '550e8400-e29b-41d4-a716-446655440000';
const range = '?from=2024-01-01&to=2024-01-04';

const series = [
  { date: '2024-01-01', precipMm: 0, tMaxC: 25, tMinC: 12 },
  { date: '2024-01-02', precipMm: 3.5, tMaxC: 26, tMinC: 13 },
  { date: '2024-01-04', precipMm: null, tMaxC: 27, tMinC: null },
];
const provenance = {
  runId: 77, source: 'NASA POWER', product: 'TEST FIXTURE', isSynthetic: false, dataStatus: 'cached',
  retrievedAt: '2026-11-01T00:00:00.000Z', units: { PRECTOTCORR: 'mm/day' },
};

function appWith({ ctx, climate }) {
  const repo = {
    getFieldGeoContext: async (id) => (id === FIELD_ID ? ctx : null),
    getClimateByCell: async () => climate,
  };
  return createApp(loadConfig({}), { fieldService: createFieldService(repo) });
}

const baseCtx = {
  id: FIELD_ID, name: 'North field', areaHa: 1.2,
  district: { id: 1, slug: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী' },
  point: { lat: 24.37, lon: 88.6 },
  bbox: { minLon: 88.6, maxLon: 88.61, minLat: 24.37, maxLat: 24.38 },
};

describe('GET /api/fields/:id/climate', () => {
  it('returns the cell data with resolution, provenance and limitations', async () => {
    const res = await request(appWith({ ctx: baseCtx, climate: { provenance, series } })).get(`/api/fields/${FIELD_ID}/climate${range}`);
    expect(res.status).toBe(200);
    expect(res.body.cell).toMatchObject({ provider: 'NASA POWER', cellKey: '49:430', centerLat: 24.5, centerLon: 88.75, resolutionDeg: { lat: 0.5, lon: 0.625 }, gridVerified: true });
    expect(res.body.cell.approxAreaKm2).toBeGreaterThan(3000);
    expect(res.body.location.representativePoint).toMatchObject({ lat: 24.37, lon: 88.6, method: 'ST_PointOnSurface' });
    expect(res.body.spatialContext.spansMultipleCells).toBe(false);
    expect(res.body.provenance).toMatchObject({ runId: 77, source: 'NASA POWER', isSynthetic: false });
    expect(res.body.limitations.join(' ')).toMatch(/whole NASA POWER grid cell/);
    expect(res.body.limitations.join(' ')).not.toMatch(/not yet been confirmed/); // the grid has been verified
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('reports days it does not have as null, never as zero, and counts them', async () => {
    const res = await request(appWith({ ctx: baseCtx, climate: { provenance, series } })).get(`/api/fields/${FIELD_ID}/climate${range}`);
    expect(res.body.daily).toHaveLength(4);
    expect(res.body.daily[2]).toEqual({ date: '2024-01-03', precipMm: null, tMaxC: null, tMinC: null }); // absent from the series
    expect(res.body.daily[3]).toEqual({ date: '2024-01-04', precipMm: null, tMaxC: 27, tMinC: null });
    expect(res.body.provenance.missing).toEqual({ precipMm: 2, tMaxC: 1, tMinC: 2 });
  });

  it('warns when the field crosses a cell edge', async () => {
    const ctx = { ...baseCtx, bbox: { minLon: 88.6, maxLon: 88.61, minLat: 24.7, maxLat: 24.8 }, point: { lat: 24.72, lon: 88.6 } };
    const res = await request(appWith({ ctx, climate: { provenance, series } })).get(`/api/fields/${FIELD_ID}/climate${range}`);
    expect(res.body.spatialContext.spansMultipleCells).toBe(true);
    expect(res.body.limitations.join(' ')).toMatch(/crosses a grid-cell edge/);
  });

  it('answers 404 CLIMATE_CELL_NOT_INGESTED when the cell has no stored data', async () => {
    const res = await request(appWith({ ctx: baseCtx, climate: null })).get(`/api/fields/${FIELD_ID}/climate${range}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIMATE_CELL_NOT_INGESTED');
    expect(res.body.error.message).toMatch(/49:430/);
  });

  it('answers 404 FIELD_NOT_FOUND for an unknown or foreign field', async () => {
    const res = await request(appWith({ ctx: baseCtx, climate: { provenance, series } })).get(`/api/fields/00000000-0000-4000-8000-000000000000/climate${range}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FIELD_NOT_FOUND');
  });

  it('validates the id and the date range', async () => {
    const app = appWith({ ctx: baseCtx, climate: { provenance, series } });
    expect((await request(app).get(`/api/fields/not-a-uuid/climate${range}`)).status).toBe(422);
    expect((await request(app).get(`/api/fields/${FIELD_ID}/climate`)).status).toBe(422);
    expect((await request(app).get(`/api/fields/${FIELD_ID}/climate?from=2024-02-01&to=2024-01-01`)).status).toBe(422);
    expect((await request(app).get(`/api/fields/${FIELD_ID}/climate?from=2010-01-01&to=2024-01-01`)).status).toBe(422);
  });
});

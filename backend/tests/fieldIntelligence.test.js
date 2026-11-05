// API tests for GET /api/fields/:id/intelligence. The repository is a FAKE with hand-built data;
// the "NASA POWER" label is a test label only. None of these numbers is a NASA observation.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createFieldService } from '../src/services/fieldService.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';

const FIELD_ID = '550e8400-e29b-41d4-a716-446655440000';
const URL = `/api/fields/${FIELD_ID}/intelligence`;

const series = buildSeries(2001, 2005, (y, m) => ({ precipMm: m >= 6 && m <= 9 ? 8 : 0.5, tMaxC: 31, tMinC: 21 }));
const provenance = {
  runId: 77, source: 'NASA POWER', product: 'TEST FIXTURE', isSynthetic: false, dataStatus: 'cached',
  retrievedAt: '2026-11-01T00:00:00.000Z', units: { PRECTOTCORR: 'mm/day' },
};
const baseCtx = {
  id: FIELD_ID, name: 'North field', areaHa: 1.2,
  soil: { soilType: null, soilPh: null, organicMatterPct: null, salinityDsM: null, irrigationSource: null },
  district: { id: 1, slug: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী' },
  point: { lat: 24.37, lon: 88.6 },
  bbox: { minLon: 88.6, maxLon: 88.61, minLat: 24.37, maxLat: 24.38 },
};

function appWith({ ctx = baseCtx, climate = { provenance, series } } = {}) {
  const repo = {
    getFieldGeoContext: async (id) => (id === FIELD_ID ? ctx : null),
    getClimateByCell: async () => climate,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
  };
  return createApp(loadConfig({}), { fieldService: createFieldService(repo) });
}

describe('GET /api/fields/:id/intelligence', () => {
  it('returns evidence for every crop, with cell, provenance, limitations and a summary sentence', async () => {
    const res = await request(appWith()).get(URL);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.status).toBe('preliminary');
    expect(res.body.field).toMatchObject({ id: FIELD_ID, name: 'North field', areaHa: 1.2 });
    expect(res.body.cell).toMatchObject({ provider: 'NASA POWER', cellKey: '49:430', gridVerified: true });
    expect(res.body.climate.monthly).toHaveLength(12);
    expect(res.body.climate.firstDate).toBe('2001-01-01');
    expect(res.body.crops).toHaveLength(CROPS.length);
    expect(res.body.crops[0].traitBasis).toBe('UNVERIFIED_GENERAL_KNOWLEDGE');
    expect(res.body.provenance).toMatchObject({ runId: 77, source: 'NASA POWER', isSynthetic: false });
    expect(res.body.dataLabel.kind).toBe('nasa_stored');
    expect(res.body.summary.en).toContain('NASA POWER grid cell');
    expect(res.body.summary.en).toMatch(/not a forecast/);
    expect(res.body.summary.bn).toContain('পূর্বাভাস নয়');
    expect(res.body.summary.bn).not.toMatch(/[0-9]/);
    expect(res.body.summary.reviewStatus).toBe('BANGLA_DRAFT_NOT_NATIVE_REVIEWED');
    expect(res.body.limitations.join(' ')).toMatch(/unverified/);
  });

  it('does not rank or score anything in version 1', async () => {
    const res = await request(appWith()).get(URL);
    expect(res.body).not.toHaveProperty('ranking');
    expect(res.body).not.toHaveProperty('score');
    for (const crop of res.body.crops) {
      expect(crop).not.toHaveProperty('score');
      expect(crop).not.toHaveProperty('rank');
    }
  });

  it('uses entered salinity: 5 dS/m is "moderate", which exceeds a crop with tolerance 2', async () => {
    const ctx = { ...baseCtx, soil: { ...baseCtx.soil, salinityDsM: 5, soilPh: 6.8 } };
    const res = await request(appWith({ ctx })).get(URL);
    expect(res.body.soil.salinityClass).toBe('moderate');
    expect(res.body.soil.usedInThisVersion).toEqual(['salinityDsM']);
    expect(res.body.soil.enteredButNotUsed).toEqual(['soilPh']);
    expect(res.body.soil.notEntered).toEqual(expect.arrayContaining(['soilType', 'organicMatterPct', 'irrigationSource']));
    const aman = res.body.crops.find((c) => c.slug === 'aman');
    expect(aman.salinity.compatibility).toBe('exceeds_tolerance');
    expect(aman.flags).toContain('salinity_exceeds_tolerance');
    expect(res.body.summary.en).toMatch(/is above the tolerance assumed for/);
  });

  it('says soil fit was not checked when no salinity was entered', async () => {
    const res = await request(appWith()).get(URL);
    expect(res.body.soil.salinityClass).toBeNull();
    expect(res.body.summary.en).toContain('soil fit was not checked');
    expect(res.body.crops.every((c) => c.flags.includes('salinity_not_entered'))).toBe(true);
  });

  it('warns when the field crosses a grid-cell edge', async () => {
    const ctx = { ...baseCtx, spansMultipleCells: true };
    const res = await request(appWith({ ctx })).get(URL);
    expect(res.body.spatialContext.spansMultipleCells).toBe(true);
    expect(res.body.limitations.join(' ')).toMatch(/intersects more than one provider grid cell/);
  });

  it('is deterministic', async () => {
    const a = await request(appWith()).get(URL);
    const b = await request(appWith()).get(URL);
    expect(a.body).toEqual(b.body);
  });
});

describe('field intelligence errors', () => {
  it('404 for an unknown field id', async () => {
    const res = await request(appWith()).get('/api/fields/660e8400-e29b-41d4-a716-446655440000/intelligence');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FIELD_NOT_FOUND');
  });
  it('422 for an id that is not a uuid', async () => {
    const res = await request(appWith()).get('/api/fields/not-a-uuid/intelligence');
    expect(res.status).toBe(422);
  });
  it('404 CLIMATE_CELL_NOT_INGESTED when the cell has no stored real data, not an empty success', async () => {
    const res = await request(appWith({ climate: null })).get(URL);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIMATE_CELL_NOT_INGESTED');
  });
  it('503 without a database instead of pretending', async () => {
    const res = await request(createApp(loadConfig({}))).get(URL);
    expect(res.status).toBe(503);
  });
});

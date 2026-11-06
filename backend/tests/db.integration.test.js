// Integration test against a REAL PostgreSQL database (local or a Neon dev branch).
// It is skipped unless TEST_DATABASE_URL is set, because it needs a migrated database:
//   TEST_DATABASE_URL=postgresql://... npm test
// It creates one throw-away district and deletes it afterwards.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { ingestDistrict } from '../src/integrations/nasa/ingest.js';
import { storeRun } from '../src/data/climateStore.js';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { generateSyntheticSeries } from '../src/integrations/fixture/synthetic.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { CROPS } from '../src/data/reference/crops.js';
import { FieldGeometryError, FieldDistrictError } from '../src/utils/fieldErrors.js';
import crypto from 'node:crypto';
import request from 'supertest';

const url = process.env.TEST_DATABASE_URL;
const SLUG = 'zz-test-district';

describe.skipIf(!url)('database integration', () => {
  let prisma;
  let repo;
  let district;

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    repo = createRepository(prisma);
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    district = await prisma.district.create({
      data: { slug: SLUG, nameEn: 'Test', nameBn: 'টেস্ট', division: 'Test', latitude: 24.37, longitude: 88.6, coordNote: 'test' },
    });
    for (const c of CROPS) await prisma.crop.upsert({ where: { slug: c.slug }, create: c, update: c });
  });

  afterAll(async () => {
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    const { cellKey } = powerCellFor(24.37, 88.6); // the test district's cell; removed only if no run uses it
    await prisma.$executeRaw`DELETE FROM "ClimateGridCell" c WHERE c."cellKey" = ${cellKey} AND c."provider" = 'NASA POWER' AND NOT EXISTS (SELECT 1 FROM "DatasetRun" r WHERE r."gridCellId" = c."id")`;
    await prisma.$disconnect();
  });

  it('answers the database health check', async () => {
    expect(await repo.ping()).toBe(true);
  });

  it('stores a synthetic run and reads it back with provenance', async () => {
    const days = generateSyntheticSeries({ startYear: 2001, endYear: 2005, seed: 7 });
    await storeRun(prisma, {
      districtId: district.id,
      days,
      run: { source: 'SYNTHETIC', isSynthetic: true, endpointUrl: 'synthetic://test', requestParams: { seed: 7 }, startDate: '2001-01-01', endDate: '2005-12-31' },
    });
    const climate = await repo.getClimate(district.id);
    expect(climate.provenance.isSynthetic).toBe(true);
    expect(climate.series).toHaveLength(days.length);
    expect(climate.series[0].date).toBe('2001-01-01');
  });

  it('prefers real data over synthetic and keeps null for missing values', async () => {
    const fetchPower = async () => ({
      url: 'https://example.invalid/power',
      parsed: {
        days: [
          { date: '2001-01-01', precipMm: null, tMaxC: 25, tMinC: 12 },
          { date: '2001-01-02', precipMm: 3.2, tMaxC: 26, tMinC: 13 },
        ],
        fillValue: -999,
        units: { PRECTOTCORR: 'mm/day', T2M_MAX: 'C', T2M_MIN: 'C' },
        missing: { precipMm: 1, tMaxC: 0, tMinC: 0 },
        warnings: ['fixture'],
        product: 'TEST FIXTURE (not NASA data)',
        sources: null,
        apiVersion: null,
        timeStandard: null,
      },
    });
    // 50% missing on one variable exceeds the 20% limit, so this must be REFUSED and recorded as failed.
    const refused = await ingestDistrict({ prisma, district, startYear: 2001, endYear: 2001, fetchPower });
    expect(refused.ok).toBe(false);
    const failed = await repo.recentFailedRuns();
    expect(failed.some((f) => f.district === SLUG && /Too much missing data/.test(f.errorMessage))).toBe(true);

    const okFetch = async () => {
      const r = await fetchPower();
      r.parsed.days = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(Date.UTC(2001, 0, 1 + i)).toISOString().slice(0, 10),
        precipMm: i === 3 ? null : 1,
        tMaxC: 30,
        tMinC: 20,
      }));
      r.parsed.missing = { precipMm: 1, tMaxC: 0, tMinC: 0 };
      return r;
    };
    const accepted = await ingestDistrict({ prisma, district, startYear: 2001, endYear: 2001, fetchPower: okFetch });
    expect(accepted.ok).toBe(true);

    const climate = await repo.getClimate(district.id);
    expect(climate.provenance.isSynthetic).toBe(false);
    expect(climate.provenance.source).toBe('NASA POWER');
    expect(climate.provenance.product).toMatch(/TEST FIXTURE/);
    expect(climate.series[3].precipMm).toBeNull();
    expect(climate.provenance.missingCount).toBe(1);
  });

  it('does not let a newer run from another real source shadow NASA POWER', async () => {
    const days = [{ date: '2001-01-01', precipMm: 999, tMaxC: 50, tMinC: 40 }];
    const other = await storeRun(prisma, {
      districtId: district.id,
      days,
      run: { source: 'TEST OTHER SOURCE', isSynthetic: false, endpointUrl: 'test://other', requestParams: {}, startDate: '2001-01-01', endDate: '2001-01-01' },
    });
    try {
      const climate = await repo.getClimate(district.id);
      expect(climate.provenance.source).toBe('NASA POWER');
      expect(climate.series.every((d) => d.precipMm !== 999)).toBe(true);
      const asked = await repo.getClimate(district.id, { source: 'TEST OTHER SOURCE' });
      expect(asked.provenance.source).toBe('TEST OTHER SOURCE');
    } finally {
      await prisma.datasetRun.delete({ where: { id: other.id } });
    }
  });

  it('serves a full evaluation from the database through the API', async () => {
    const app = createApp(loadConfig({}), { repository: repo });
    const res = await request(app).post('/api/evaluate').send({ district: SLUG, existingRotation: ['aman', 'mustard'] });
    expect(res.status).toBe(200);
    expect(res.body.strategies.length).toBe(4);
  });

  it('completes the field CRUD workflow through the API', async () => {
    const application = createApp(loadConfig({}), { repository: repo });
    const app = request.agent(application); // keeps the anonymous session cookie between calls
    const boundary = {
      type: 'Polygon',
      coordinates: [[[88.6, 24.37], [88.61, 24.37], [88.61, 24.38], [88.6, 24.37]]],
    };
    const replacementBoundary = {
      type: 'Polygon',
      coordinates: [[[88.6, 24.37], [88.62, 24.37], [88.62, 24.39], [88.6, 24.37]]],
    };

    const spoofed = await app.post('/api/fields').send({
      name: 'Spoofed Area', districtId: district.id, boundary, areaHa: 999,
    });
    expect(spoofed.status).toBe(422);
    expect(spoofed.body.error.details[0].field).toBe('areaHa');

    const created = await app.post('/api/fields').send({
      name: 'Integration Field',
      districtId: district.id,
      boundary,
      soilType: 'Clay',
      soilPh: 6.5,
    });
    expect(created.status).toBe(201);
    expect(created.body.field.boundary.type).toBe('MultiPolygon');
    expect(created.body.field.district.id).toBe(district.id);
    expect(created.body.field.soilType).toBe('Clay');
    expect(created.body.field.areaHa).toBeGreaterThan(0);

    const id = created.body.field.id;

    // One field per anonymous session.
    const second = await app.post('/api/fields').send({ name: 'Second', districtId: district.id, boundary });
    expect(second.status).toBe(409);

    // A different session cannot see, change or delete this field.
    const stranger = request.agent(application);
    expect((await stranger.get('/api/fields')).body.fields).toHaveLength(0);
    expect((await stranger.get(`/api/fields/${id}`)).status).toBe(404);
    expect((await stranger.patch(`/api/fields/${id}`).send({ name: 'Stolen' })).status).toBe(404);
    expect((await stranger.delete(`/api/fields/${id}`)).status).toBe(404);

    const listed = await app.get('/api/fields');
    expect(listed.status).toBe(200);
    expect(listed.body.fields.some((field) => field.id === id)).toBe(true);

    const retrieved = await app.get(`/api/fields/${id}`);
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.field.boundary.type).toBe('MultiPolygon');

    const metadataUpdate = await app.patch(`/api/fields/${id}`).send({ soilType: null });
    expect(metadataUpdate.status).toBe(200);
    expect(metadataUpdate.body.field.soilType).toBeNull();
    expect(metadataUpdate.body.field.areaHa).toBe(created.body.field.areaHa);

    const boundaryUpdate = await app.patch(`/api/fields/${id}`).send({ boundary: replacementBoundary });
    expect(boundaryUpdate.status).toBe(200);
    expect(boundaryUpdate.body.field.boundary.type).toBe('MultiPolygon');
    expect(boundaryUpdate.body.field.areaHa).toBeGreaterThan(created.body.field.areaHa);

    const invalidBoundary = await app.patch(`/api/fields/${id}`).send({
      boundary: { type: 'Polygon', coordinates: [[[88.6, 24.37], [88.62, 24.37], [88.6, 24.38]]] },
    });
    expect(invalidBoundary.status).toBe(422);
    expect((await app.get(`/api/fields/${id}`)).body.field.boundary.type).toBe('MultiPolygon');

    const deleted = await app.delete(`/api/fields/${id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted.id).toBe(id);
    expect((await app.get(`/api/fields/${id}`)).status).toBe(404);
  });

  it('rejects invalid field references and preserves records after failed updates', async () => {
    const application = createApp(loadConfig({}), { repository: repo });
    const app = request.agent(application);
    const sessionId = `test-session-${crypto.randomUUID()}`; // repository-level calls need a session id
    const boundary = {
      type: 'Polygon',
      coordinates: [[[88.6, 24.37], [88.61, 24.37], [88.61, 24.38], [88.6, 24.37]]],
    };
    const created = await repo.createField({ name: 'Rollback Field', districtId: district.id, boundary }, sessionId);

    await expect(repo.createField({ name: 'Bad District Field', districtId: 999999, boundary }, `${sessionId}-b`)).rejects.toBeInstanceOf(
      FieldDistrictError,
    );
    expect(await repo.listFields(sessionId)).toHaveLength(1);

    await expect(repo.updateField(created.id, { districtId: 999999 }, sessionId)).rejects.toBeInstanceOf(FieldDistrictError);
    await expect(repo.updateField(created.id, {
      boundary: {
        type: 'Polygon',
        coordinates: [[[88.6, 24.37], [88.61, 24.38], [88.61, 24.37], [88.6, 24.38], [88.6, 24.37]]],
      },
    }, sessionId)).rejects.toBeInstanceOf(FieldGeometryError);

    const unchanged = await repo.getField(created.id, sessionId);
    expect(unchanged.name).toBe('Rollback Field');
    expect(unchanged.boundary.type).toBe('MultiPolygon');
    expect(await repo.deleteField(created.id, `${sessionId}-other`)).toBe(false); // wrong session
    expect(await repo.deleteField(created.id, sessionId)).toBe(true);

    const invalidCreate = await app.post('/api/fields').send({
      name: 'Invalid Field',
      districtId: district.id,
      boundary: { type: 'Point', coordinates: [88.6, 24.37] },
    });
    expect(invalidCreate.status).toBe(422);
    expect((await app.post('/api/fields').send({
      name: 'Unknown District Field',
      districtId: 999999,
      boundary,
    })).status).toBe(404);
  });
});

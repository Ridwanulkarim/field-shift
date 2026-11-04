// Field-to-climate mapping against a real PostgreSQL + PostGIS database. Skipped unless TEST_DATABASE_URL
// points at a THROW-AWAY test database. Uses stored fixture data only: no NASA request is made.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { storeRun, ensureGridCell, backfillGridCells } from '../src/data/climateStore.js';
import { powerCellFor } from '../src/geo/climateGrid.js';

const url = process.env.TEST_DATABASE_URL;
const NEAR = { slug: 'zz-fc-near', lat: 21.0, lon: 92.2 }; // its cell receives fixture data
const FAR = { slug: 'zz-fc-far', lat: 24.37, lon: 88.6 }; // about 480 km away: used for the district-distance guard
const RANGE = '?from=2024-01-01&to=2024-01-04';

const square = (lon, lat, size = 0.01) => ({
  type: 'Polygon',
  coordinates: [[[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]]],
});
// A "U" shape: its centroid falls in the notch, OUTSIDE the polygon.
const uShape = {
  type: 'Polygon',
  coordinates: [[[92.20, 21.00], [92.23, 21.00], [92.23, 21.03], [92.22, 21.03], [92.22, 21.01], [92.21, 21.01], [92.21, 21.03], [92.20, 21.03], [92.20, 21.00]]],
};
const days = (list) => list.map(([date, precipMm]) => ({ date, precipMm, tMaxC: 30, tMinC: 20 }));

describe.skipIf(!url)('field climate through PostGIS', () => {
  let prisma; let repo; let app; let near; let far; let nearCell; let storedRun; const touchedCellKeys = new Set();
  const agent = () => request.agent(app); // one agent = one anonymous session (cookie kept)
  const createField = (a, body) => a.post('/api/fields').send({ name: 'Test field', districtId: near.id, ...body });

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    repo = createRepository(prisma);
    app = createApp(loadConfig({}), { repository: repo });
    await prisma.district.deleteMany({ where: { slug: { in: [NEAR.slug, FAR.slug] } } });
    const mk = (d) => prisma.district.create({ data: { slug: d.slug, nameEn: d.slug, nameBn: d.slug, division: 'Test', latitude: d.lat, longitude: d.lon, coordNote: 'test' } });
    near = await mk(NEAR);
    far = await mk(FAR);
    const cell = powerCellFor(NEAR.lat, NEAR.lon);
    touchedCellKeys.add(cell.cellKey);
    nearCell = await ensureGridCell(prisma, cell);
    storedRun = await storeRun(prisma, {
      districtId: near.id,
      days: days([['2024-01-01', 0], ['2024-01-02', 4.5], ['2024-01-04', null]]),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: '2024-01-01', endDate: '2024-01-04', product: 'TEST FIXTURE (not NASA data)', gridCellId: nearCell.id },
    });
  });

  afterAll(async () => {
    await prisma.field.deleteMany({ where: { districtId: { in: [near.id, far.id] } } });
    await prisma.district.deleteMany({ where: { slug: { in: [NEAR.slug, FAR.slug] } } });
    touchedCellKeys.add(powerCellFor(NEAR.lat + 0.3, NEAR.lon).cellKey);
    for (const key of touchedCellKeys) { // remove only cells that no run uses
      await prisma.$executeRaw`DELETE FROM "ClimateGridCell" c WHERE c."cellKey" = ${key} AND c."provider" = 'NASA POWER' AND NOT EXISTS (SELECT 1 FROM "DatasetRun" r WHERE r."gridCellId" = c."id")`;
    }
    await prisma.$disconnect();
  });

  it('serves a field the climate of the grid cell that contains it', async () => {
    const a = agent();
    const created = await createField(a, { boundary: square(92.2, 21.0) });
    expect(created.status).toBe(201);
    const res = await a.get(`/api/fields/${created.body.field.id}/climate${RANGE}`);
    expect(res.status).toBe(200);
    expect(res.body.cell.cellKey).toBe(powerCellFor(NEAR.lat, NEAR.lon).cellKey);
    expect(res.body.provenance.runId).toBe(storedRun.id);
    expect(res.body.provenance.isSynthetic).toBe(false);
    expect(res.body.daily.map((d) => d.precipMm)).toEqual([0, 4.5, null, null]); // 01-03 absent, 01-04 stored as null
    expect(res.body.spatialContext.spansMultipleCells).toBe(false);
    expect(res.body.spatialContext.fieldToCellAreaRatio).toBeLessThan(0.001);
  });

  it('gives two fields in the same cell the SAME observations (a shared cell, not two datasets)', async () => {
    const a = agent(); const b = agent();
    const fa = (await createField(a, { boundary: square(92.2, 21.0) })).body.field;
    const fb = (await createField(b, { boundary: square(92.3, 21.1) })).body.field;
    const ra = await a.get(`/api/fields/${fa.id}/climate${RANGE}`);
    const rb = await b.get(`/api/fields/${fb.id}/climate${RANGE}`);
    expect(ra.body.provenance.runId).toBe(rb.body.provenance.runId);
    expect(ra.body.cell.cellKey).toBe(rb.body.cell.cellKey);
    expect(ra.body.daily).toEqual(rb.body.daily);
  });

  it('does not borrow data from a neighbouring cell: a field in an un-ingested cell gets a clear 404', async () => {
    const a = agent();
    const created = await createField(a, { boundary: square(92.2, 21.3) }); // about 33 km north, next cell
    expect(created.status).toBe(201);
    const res = await a.get(`/api/fields/${created.body.field.id}/climate${RANGE}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIMATE_CELL_NOT_INGESTED');
    expect(res.body.error.message).toContain(powerCellFor(21.3, 92.2).cellKey);
  });

  it("does not show one session's field climate to another session", async () => {
    const owner = agent(); const other = agent();
    const created = await createField(owner, { boundary: square(92.2, 21.0) });
    const res = await other.get(`/api/fields/${created.body.field.id}/climate${RANGE}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FIELD_NOT_FOUND');
  });

  it('uses a representative point that lies ON the polygon, even where the centroid does not', async () => {
    const a = agent();
    const created = await createField(a, { boundary: uShape });
    expect(created.status).toBe(201);
    const ctx = await repo.getFieldGeoContext(created.body.field.id, (await prisma.field.findUnique({ where: { id: created.body.field.id } })).sessionId);
    const [row] = await prisma.$queryRaw`
      SELECT ST_Contains(f."boundary", ST_SetSRID(ST_MakePoint(${ctx.point.lon}, ${ctx.point.lat}), 4326)) AS "pointOnField",
             ST_Contains(f."boundary", ST_Centroid(f."boundary")) AS "centroidOnField"
      FROM "Field" f WHERE f."id" = ${created.body.field.id}::uuid`;
    expect(row.centroidOnField).toBe(false); // the reason the centroid is not used
    expect(row.pointOnField).toBe(true);
    expect(ctx.bbox).toEqual({ minLon: 92.2, maxLon: 92.23, minLat: 21.0, maxLat: 21.03 });
  });

  it('flags a field whose bounding box crosses a cell edge', async () => {
    const a = agent();
    // The cell centred on latitude 21.0 ends at 21.25: this field spans 21.20 to 21.30.
    const created = await createField(a, { boundary: square(92.2, 21.2, 0.1) });
    expect(created.status).toBe(201);
    const ctx = await repo.getFieldGeoContext(created.body.field.id, (await prisma.field.findUnique({ where: { id: created.body.field.id } })).sessionId);
    expect(ctx.bbox.minLat).toBeCloseTo(21.2, 6);
    expect(ctx.bbox.maxLat).toBeCloseTo(21.3, 6);
    const { spansMultipleCells } = await import('../src/geo/climateGrid.js');
    expect(spansMultipleCells(ctx.bbox)).toBe(true);
  });

  it('rejects a field outside Bangladesh (the case that was accepted before)', async () => {
    const res = await createField(agent(), { boundary: square(-60, -10) });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toMatch(/Bangladesh/);
  });

  it('rejects a field more than 100 km from its district, on create and on a district change', async () => {
    const tooFar = await createField(agent(), { boundary: square(88.6, 24.37) }); // inside Bangladesh, ~480 km from NEAR
    expect(tooFar.status).toBe(422);
    expect(JSON.stringify(tooFar.body)).toMatch(/100 km/);

    const a = agent();
    const ok = await createField(a, { boundary: square(92.2, 21.0) });
    expect(ok.status).toBe(201);
    const moved = await a.patch(`/api/fields/${ok.body.field.id}`).send({ districtId: far.id });
    expect(moved.status).toBe(422);
    expect(JSON.stringify(moved.body)).toMatch(/100 km/);
    const unchanged = await a.get(`/api/fields/${ok.body.field.id}`);
    expect(unchanged.body.field.districtId).toBe(near.id); // the rejected change was not applied
  });

  it('backfills the grid cell of stored runs, only for what is still empty, and can be repeated', async () => {
    const d = await prisma.district.create({ data: { slug: 'zz-fc-backfill', nameEn: 'b', nameBn: 'b', division: 'Test', latitude: 22.81, longitude: 89.55, coordNote: 'test' } });
    try {
      const expected = powerCellFor(22.81, 89.55);
      touchedCellKeys.add(expected.cellKey);
      const run = await storeRun(prisma, {
        districtId: d.id, days: days([['2024-01-01', 1]]),
        run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: '2024-01-01', endDate: '2024-01-01' }, // no gridCellId: an old-style run
      });
      const dry = await backfillGridCells(prisma, { dryRun: true, districtId: d.id });
      expect(dry.runsFound).toBe(1);
      expect(dry.cells[0].cellKey).toBe(expected.cellKey);
      expect((await prisma.datasetRun.findUnique({ where: { id: run.id } })).gridCellId).toBeNull(); // dry run wrote nothing

      const real = await backfillGridCells(prisma, { districtId: d.id });
      expect(real.runsUpdated).toBe(1);
      const cell = await prisma.climateGridCell.findFirst({ where: { provider: 'NASA POWER', cellKey: expected.cellKey } });
      expect((await prisma.datasetRun.findUnique({ where: { id: run.id } })).gridCellId).toBe(cell.id);
      expect(cell.centerLat).toBe(expected.centerLat);

      expect((await backfillGridCells(prisma, { districtId: d.id })).runsFound).toBe(0); // nothing left: safe to repeat
      expect((await prisma.climateDaily.count({ where: { runId: run.id } }))).toBe(1); // values untouched
    } finally {
      await prisma.district.delete({ where: { id: d.id } });
    }
  });
});

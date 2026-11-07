import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { createFieldService } from '../src/services/fieldService.js';
import { imergPixelList, imergPixelsInCell } from '../src/geo/imergGrid.js';
import { powerCellFor } from '../src/geo/climateGrid.js';

const FIELD_ID = '550e8400-e29b-41d4-a716-446655440000';
const URL = `/api/fields/${FIELD_ID}/rain-evidence`;
const NATIVE_URL = `/api/fields/${FIELD_ID}/imerg-native?from=2001-07-01&to=2001-07-05`;

// Synthetic test series (not NASA data).
function build(years, scale = 1) {
  const out = [];
  for (const year of years) {
    for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += 86400000) {
      const d = new Date(t);
      const m = d.getUTCMonth() + 1;
      out.push({ date: d.toISOString().slice(0, 10), precipMm: (m >= 6 && m <= 9 ? 10 + (d.getUTCDate() % 4) : 0) * scale, tMaxC: null, tMinC: null });
    }
  }
  return out;
}
const prov = (source) => ({
  runId: 1, source, product: 'TEST FIXTURE', isSynthetic: false, dataStatus: 'cached',
  retrievedAt: '2026-11-01T00:00:00.000Z', startDate: '2001-01-01', endDate: '2005-12-31', units: {}, rowCount: 1826, missingCount: 0, notes: null, resolutionNote: 'test',
});
const YEARS = [2001, 2002, 2003, 2004, 2005];
const POWER = { provenance: prov('NASA POWER'), series: build(YEARS) };

// A fake native IMERG block: every pixel of `block` carries the same series (scaled), with a half-hourly count and file version.
function nativeBlock(block, { scale = 1.5, years = YEARS, onlyPixels = null, maxDays = null } = {}) {
  const pixels = imergPixelList(block).slice(0, onlyPixels ?? undefined);
  const series = build(years, scale).slice(0, maxDays ?? undefined);
  return {
    pixelsExpected: block.pixelCount,
    runs: pixels.map((p, i) => ({
      cellKey: p.cellKey, runId: 100 + i, retrievedAt: '2026-11-06T00:00:00.000Z', startDate: '2001-01-01', endDate: '2005-12-31', rowCount: series.length, missingCount: 0,
      product: 'TEST FIXTURE (not NASA data)', units: { precipMm: 'mm/day' },
      requestParams: { collection: { shortName: 'GPM_3IMERGDF', collectionVersion: '07' }, versionNote: 'collection vs file version note', fileVersions: ['V07B'] },
    })),
    rows: pixels.flatMap((p) => series.map((d) => ({ cellKey: p.cellKey, date: d.date, precipMm: d.precipMm, precipitationCnt: 48, fileVersion: 'V07B' }))),
  };
}

const baseCtx = {
  id: FIELD_ID, name: 'North field', areaHa: 1.2,
  district: { id: 1, slug: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী' },
  point: { lat: 24.37, lon: 88.6 },
  bbox: { minLon: 88.6, maxLon: 88.61, minLat: 24.37, maxLat: 24.38 },
};
const CELL_BLOCK = imergPixelsInCell(powerCellFor(24.37, 88.6));

function appWith({ ctx = baseCtx, power = POWER, native = 'default' } = {}) {
  const calls = { block: [], cell: [] };
  const repo = {
    getFieldGeoContext: async (id) => (id === FIELD_ID ? ctx : null),
    getClimateByCell: async (cell) => { calls.cell.push(cell.cellKey); return power; },
    getImergBlock: async (block) => {
      calls.block.push(block);
      if (native === null) return null;
      return native === 'default' ? nativeBlock(block) : native(block);
    },
  };
  return { app: createApp(loadConfig({}), { fieldService: createFieldService(repo) }), calls };
}

describe('GET /api/fields/:id/rain-evidence', () => {
  it('compares POWER with the aggregated native IMERG pixels and labels it evidence only', async () => {
    const { app, calls } = appWith();
    const res = await request(app).get(URL);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('preliminary');
    expect(res.body.statusNote).toMatch(/does not recommend/);
    expect(res.body.cell.cellKey).toBe('49:430');
    expect(res.body.comparison.status).toBe('ok');
    expect(res.body.comparison.daily.imergToPowerRatio).toBeCloseTo(1.5, 1);
    expect(res.body.comparison.flags).toContain('IMERG_WETTER_THAN_POWER');
    expect(res.headers['cache-control']).toBe('private, no-store');
    // the native pixels of the POWER cell were requested, not a pre-averaged value
    expect(calls.block[0]).toMatchObject({ pixelCount: 35, rows: { first: 1142, last: 1146 }, cols: { first: 2684, last: 2690 } });
    expect(calls.cell).toEqual(['49:430']);
  });

  it('documents the aggregation method and its spatial limits', async () => {
    const res = await request(appWith().app).get(URL);
    expect(res.body.sources.imerg.aggregation.name).toMatch(/equal-weight mean of valid 0\.1 degree pixels/);
    expect(res.body.sources.imerg.aggregation.weighting).toMatch(/equal/);
    const text = res.body.limitations.join(' ');
    expect(text).toMatch(/approximates the NASA POWER cell footprint/);
    expect(text).toMatch(/different spatial scales/);
    expect(text).toMatch(/not guaranteed to be independent/);
    expect(text).toMatch(/up to about 4 months/);
    expect(text).toMatch(/heuristics/);
  });

  it('reports version provenance and the quality count of the IMERG data', async () => {
    const res = await request(appWith().app).get(URL);
    const imerg = res.body.sources.imerg;
    expect(imerg.collection).toEqual({ shortName: 'GPM_3IMERGDF', collectionVersion: '07' });
    expect(imerg.fileVersions).toEqual(['V07B']);
    expect(imerg.versionNote).toMatch(/collection vs file version/);
    expect(imerg).toMatchObject({ nativeResolutionDeg: { lat: 0.1, lon: 0.1 }, pixelsExpected: 35, pixelsWithData: 35, pixelRuns: 35 });
    expect(imerg.quality).toMatchObject({ variable: 'precipitation_cnt', meanCount: 48 });
    expect(imerg.observationPeriod).toEqual({ firstDate: '2001-01-01', lastDate: '2005-12-31' });
    expect(res.body.sources.power.source).toBe('NASA POWER');
  });

  it('flags and explains an incomplete pixel block', async () => {
    const res = await request(appWith({ native: (b) => nativeBlock(b, { onlyPixels: 10 }) }).app).get(URL);
    expect(res.status).toBe(200);
    expect(res.body.comparison.flags).toContain('INCOMPLETE_IMERG_PIXEL_BLOCK');
    expect(res.body.sources.imerg.pixelsWithData).toBe(10);
    expect(res.body.limitations.join(' ')).toMatch(/Only 10 of the 35 IMERG pixels/);
    expect(res.body.comparison.status).toBe('insufficient_overlap'); // 10 of 35 pixels: no day reaches 80%
  });

  it('reports insufficient overlap instead of statistics', async () => {
    const res = await request(appWith({ native: (b) => nativeBlock(b, { years: [2001], maxDays: 100 }) }).app).get(URL);
    expect(res.status).toBe(200);
    expect(res.body.comparison.status).toBe('insufficient_overlap');
    expect(res.body.comparison.daily).toBeUndefined();
  });

  it('404 IMERG_CELL_NOT_INGESTED when only POWER exists', async () => {
    const res = await request(appWith({ native: null }).app).get(URL);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('IMERG_CELL_NOT_INGESTED');
    expect(res.body.error.message).toContain('49:430');
    expect(res.body.error.message).toContain('35 IMERG pixels');
  });

  it('404 CLIMATE_CELL_NOT_INGESTED when POWER is missing', async () => {
    const res = await request(appWith({ power: null }).app).get(URL);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIMATE_CELL_NOT_INGESTED');
  });

  it('404 for an unknown field and 422 for a bad id', async () => {
    const { app } = appWith();
    const unknown = await request(app).get('/api/fields/11111111-1111-4111-8111-111111111111/rain-evidence');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('FIELD_NOT_FOUND');
    const bad = await request(app).get('/api/fields/not-a-uuid/rain-evidence');
    expect(bad.status).toBe(422);
  });

  it('warns when the field crosses a grid-cell edge', async () => {
    const res = await request(appWith({ ctx: { ...baseCtx, spansMultipleCells: true } }).app).get(URL);
    expect(res.body.spatialContext.spansMultipleCells).toBe(true);
    expect(res.body.limitations.join(' ')).toMatch(/intersects more than one provider grid cell/);
  });
});

describe('GET /api/fields/:id/imerg-native', () => {
  it('returns the native 0.1 degree pixel containing the field, with count and file version per day', async () => {
    const { app, calls } = appWith();
    const res = await request(app).get(NATIVE_URL);
    expect(res.status).toBe(200);
    expect(res.body.pixel).toMatchObject({ provider: 'NASA GPM IMERG', cellKey: '1143:2686', centerLat: 24.35, centerLon: 88.65, resolutionDeg: { lat: 0.1, lon: 0.1 }, containsRepresentativePoint: true });
    expect(res.body.daily).toHaveLength(5);
    expect(res.body.daily[0]).toEqual({ date: '2001-07-01', precipMm: 16.5, precipitationCnt: 48, fileVersion: 'V07B' });
    expect(res.body.missingDays).toBe(0);
    expect(calls.block[0]).toMatchObject({ pixelCount: 1, rows: { first: 1143 }, cols: { first: 2686 } });
  });

  it('is not aggregated and says so, with the collection and file versions kept apart', async () => {
    const res = await request(appWith().app).get(NATIVE_URL);
    expect(res.body.provenance.aggregation).toBe('none (native pixel values)');
    expect(res.body.provenance.collection.collectionVersion).toBe('07');
    expect(res.body.provenance.fileVersions).toEqual(['V07B']);
    expect(res.body.provenance.isSynthetic).toBe(false);
    expect(res.body.limitations.join(' ')).toMatch(/not a measurement on the field/);
    expect(res.body.limitations.join(' ')).toMatch(/precipitationCnt/);
  });

  it('shows days that are not stored as null, never zero', async () => {
    const res = await request(appWith().app).get('/api/fields/' + FIELD_ID + '/imerg-native?from=2010-07-01&to=2010-07-03');
    expect(res.status).toBe(200);
    expect(res.body.daily.map((d) => d.precipMm)).toEqual([null, null, null]);
    expect(res.body.missingDays).toBe(3);
  });

  it('404 IMERG_PIXEL_NOT_INGESTED when the pixel has no data', async () => {
    const res = await request(appWith({ native: null }).app).get(NATIVE_URL);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('IMERG_PIXEL_NOT_INGESTED');
    expect(res.body.error.message).toContain('1143:2686');
  });

  it('404 for an unknown field and rejects a bad date range', async () => {
    const { app } = appWith();
    expect((await request(app).get('/api/fields/11111111-1111-4111-8111-111111111111/imerg-native?from=2001-07-01&to=2001-07-05')).status).toBe(404);
    expect((await request(app).get(`/api/fields/${FIELD_ID}/imerg-native?from=2001-07-05&to=2001-07-01`)).status).toBe(422);
  });
});

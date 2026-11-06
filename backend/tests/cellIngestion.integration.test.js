// Database tests for standalone grid-cell runs (runs with no district). FAKE fetcher: no network, and
// nothing here is labelled as live NASA data. Skipped unless TEST_DATABASE_URL points at a throw-away test database.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { ingestGridCell, refreshGridCell } from '../src/integrations/nasa/ingest.js';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { cellHasRealRun, listStandaloneCellRuns } from '../src/data/climateStore.js';

const url = process.env.TEST_DATABASE_URL;
// A point in the Sundarbans corner, away from the other test fixtures' cells.
const LAT = 22.1;
const LON = 89.3;

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const fromCompact = (c) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

function fakeFetch(opts = {}) {
  const calls = [];
  const fn = async ({ latitude, longitude, startDate, endDate }) => {
    calls.push({ latitude, longitude, startDate, endDate });
    if (opts.fail) throw new Error(opts.fail);
    const list = [];
    for (let d = fromCompact(startDate); d <= fromCompact(endDate); d = addDays(d, 1)) {
      list.push({ date: d, precipMm: opts.precip ?? 2, tMaxC: 31, tMinC: 22 });
    }
    return {
      url: 'fake://',
      parsed: {
        days: list, fillValue: -999, units: { PRECTOTCORR: 'mm/day' },
        missing: { PRECTOTCORR: 0, T2M_MAX: 0, T2M_MIN: 0 },
        warnings: [], product: 'TEST FIXTURE (not NASA data)', sources: null, apiVersion: 'test', timeStandard: 'LST',
      },
    };
  };
  fn.calls = calls;
  return fn;
}

describe.skipIf(!url)('standalone grid-cell runs (fake fetcher)', () => {
  let prisma;
  let repo;
  const cell = powerCellFor(LAT, LON);
  const cellRuns = (status) => prisma.datasetRun.findMany({ where: { districtId: null, gridCell: { cellKey: cell.cellKey }, status } });

  async function clean() {
    await prisma.$executeRaw`DELETE FROM "DatasetIngestionLock" WHERE "key" LIKE ${`NASA POWER:grid:${cell.cellKey}%`}`;
    await prisma.datasetRun.deleteMany({ where: { districtId: null, gridCell: { cellKey: cell.cellKey } } });
  }

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    repo = createRepository(prisma);
  });
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('stores a run with no district, requested at the cell centre', async () => {
    const fetchPower = fakeFetch();
    const result = await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-31', fetchPower });
    expect(result.ok).toBe(true);
    expect(fetchPower.calls[0].latitude).toBe(cell.centerLat);
    expect(fetchPower.calls[0].longitude).toBe(cell.centerLon);
    const runs = await cellRuns('SUCCESS');
    expect(runs).toHaveLength(1);
    expect(runs[0].districtId).toBeNull();
    expect(runs[0].isSynthetic).toBe(false);
  });

  it('serves the series by cell, and a cell run is not visible to district queries', async () => {
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-10', fetchPower: fakeFetch() });
    const byCell = await repo.getClimateByCell(cell);
    expect(byCell.series.length).toBe(10);
    expect(await cellHasRealRun(prisma, cell)).toBe(true);
    expect(await listStandaloneCellRuns(prisma)).toContain(cell.cellKey);
  });

  it('skips a request already covered by the stored run', async () => {
    const fetchPower = fakeFetch();
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-31', fetchPower });
    const again = await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-05', endDate: '2020-01-20', fetchPower });
    expect(again).toMatchObject({ ok: true, skipped: true, reason: 'already_covered' });
    expect(fetchPower.calls).toHaveLength(1);
  });

  it('keeps one successful run per cell when the range is extended', async () => {
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-10', fetchPower: fakeFetch() });
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-20', fetchPower: fakeFetch() });
    expect(await cellRuns('SUCCESS')).toHaveLength(1);
    expect((await repo.getClimateByCell(cell)).series.length).toBe(20);
  });

  it('does not delete a district run in the same cell', async () => {
    const district = await prisma.district.upsert({
      where: { slug: 'zz-cell-test' },
      update: {},
      create: { slug: 'zz-cell-test', nameEn: 'Cell', nameBn: 'সেল', division: 'Test', latitude: LAT, longitude: LON, coordNote: 'test' },
    });
    try {
      const districtRun = await prisma.datasetRun.create({
        data: {
          districtId: district.id, source: 'NASA POWER', product: 'TEST FIXTURE', isSynthetic: false, status: 'SUCCESS',
          endpointUrl: 'fake://', requestParams: {},
          startDate: new Date('2019-01-01T00:00:00Z'), endDate: new Date('2019-01-02T00:00:00Z'),
          units: {}, fillValue: -999,
        },
      });
      await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-10', fetchPower: fakeFetch() });
      expect(await prisma.datasetRun.findUnique({ where: { id: districtRun.id } })).not.toBeNull();
    } finally {
      await prisma.district.deleteMany({ where: { slug: 'zz-cell-test' } });
    }
  });

  it('records a failure against the cell and keeps the earlier good run', async () => {
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-10', fetchPower: fakeFetch() });
    const result = await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-02-10', fetchPower: fakeFetch({ fail: 'upstream down' }) });
    expect(result.ok).toBe(false);
    const failed = await cellRuns('FAILED');
    expect(failed).toHaveLength(1);
    expect(failed[0].errorMessage).toMatch(/upstream down/);
    expect(await cellRuns('SUCCESS')).toHaveLength(1);
    expect((await repo.getClimateByCell(cell)).series.length).toBe(10);
  });

  it('refuses to refresh a cell that has no run', async () => {
    const result = await refreshGridCell({ prisma, cellKey: cell.cellKey, fetchPower: fakeFetch() });
    expect(result).toMatchObject({ ok: false, skipped: true });
  });

  it('refreshes a stale cell run forward from its end date', async () => {
    await ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-01-01', endDate: '2020-01-10', fetchPower: fakeFetch() });
    const fetchPower = fakeFetch();
    const result = await refreshGridCell({ prisma, cellKey: cell.cellKey, fetchPower, overlapDays: 2 });
    expect(result.ok).toBe(true);
    expect(fetchPower.calls[0].startDate).toBe('20200108');
    expect(await cellRuns('SUCCESS')).toHaveLength(1);
  });

  it('rejects bad dates before any network call', async () => {
    const fetchPower = fakeFetch();
    await expect(ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-13-01', endDate: '2020-01-31', fetchPower })).rejects.toThrow();
    await expect(ingestGridCell({ prisma, cellKey: cell.cellKey, startDate: '2020-02-01', endDate: '2020-01-31', fetchPower })).rejects.toThrow(/after/);
    expect(fetchPower.calls).toHaveLength(0);
  });
});

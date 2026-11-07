// Database tests for NATIVE GPM IMERG storage (one run per 0.1 degree pixel). FAKE granule lister and fetcher: no network,
// no token, and nothing here is labelled as live NASA data. Skipped unless TEST_DATABASE_URL points at a throw-away test database.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { ingestImergBlock, imergLockKey } from '../src/integrations/nasa/imergIngest.js';
import { ImergError } from '../src/integrations/nasa/imerg.js';
import { imergBlockForPoint, imergPixelList, IMERG_PROVIDER } from '../src/geo/imergGrid.js';
import { withIngestionLock } from '../src/data/climateStore.js';

const url = process.env.TEST_DATABASE_URL;
const SOURCE = 'NASA GPM IMERG';
// A 2 x 3 pixel block (rows 1148-1149, columns 2700-2702); no other test uses IMERG-provider cells.
const BLOCK = { rows: { first: 1148, last: 1149, count: 2 }, cols: { first: 2700, last: 2702, count: 3 }, pixelCount: 6, bounds: {} };
const KEYS = imergPixelList(BLOCK).map((p) => p.cellKey);

const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const fakeGranules = (from, count, fileVersionFor = () => 'V07B') => async () => ({
  granules: Array.from({ length: count }, (_, i) => {
    const date = addDays(from, i);
    return { date, title: `fake-${i}`, opendapUrl: 'https://opendap.earthdata.nasa.gov/fake', fileVersion: fileVersionFor(date) };
  }),
  skipped: 0,
});
// Every pixel gets its OWN value (column * 10 + row offset) so any averaging would be visible.
const ownValue = (p) => (p.col - 2700) * 10 + (p.row - 1148) + 1;
function fakeFetchDay({ valueFor = (_d, p) => ownValue(p), cntFor = () => 48, failOn = () => false, fatalOn = () => false } = {}) {
  const calls = [];
  const fn = async ({ granule, block }) => {
    calls.push(granule.date);
    if (fatalOn(granule.date)) throw new ImergError('Earthdata rejected the token (HTTP 401).', { status: 401, fatal: true });
    if (failOn(granule.date)) throw new ImergError(`Request failed for ${granule.date}.`, { retryable: true });
    return { pixels: imergPixelList(block).map((p) => ({ row: p.row, col: p.col, precipMm: valueFor(granule.date, p), precipitationCnt: cntFor(granule.date, p), fileVersion: granule.fileVersion })) };
  };
  fn.calls = calls;
  return fn;
}

describe.skipIf(!url)('native GPM IMERG ingestion (fake fetcher)', () => {
  let prisma;
  let repo;
  const runs = (status, extra = {}) => prisma.datasetRun.findMany({ where: { districtId: null, source: SOURCE, status, gridCell: { provider: IMERG_PROVIDER, cellKey: { in: KEYS } }, ...extra }, include: { gridCell: true } });
  const ingest = (o) => ingestImergBlock({ prisma, block: BLOCK, startDate: '2019-01-01', endDate: '2019-12-31', concurrency: 3, ...o });

  async function clean() {
    await prisma.$executeRaw`DELETE FROM "DatasetIngestionLock" WHERE "key" LIKE ${`${imergLockKey(BLOCK)}%`}`;
    await prisma.datasetRun.deleteMany({ where: { gridCell: { provider: IMERG_PROVIDER, cellKey: { in: KEYS } } } });
  }

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    repo = createRepository(prisma);
  });
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await prisma.$executeRaw`DELETE FROM "ClimateGridCell" c WHERE c."provider" = ${IMERG_PROVIDER} AND c."cellKey" = ANY(${KEYS}::text[]) AND NOT EXISTS (SELECT 1 FROM "DatasetRun" r WHERE r."gridCellId" = c."id")`;
    await prisma.$disconnect();
  });

  it('stores every pixel on its own: one cell and one run per pixel, nothing averaged', async () => {
    const result = await ingest({ listGranules: fakeGranules('2019-07-01', 10), fetchDay: fakeFetchDay() });
    expect(result).toMatchObject({ ok: true, pixels: 6, fetched: 10, failed: 0, through: '2019-07-10' });
    const stored = await runs('SUCCESS');
    expect(stored).toHaveLength(6);
    expect(stored.every((r) => r.districtId === null && r.isSynthetic === false && r.rowCount === 10 && r.gridCell.provider === IMERG_PROVIDER)).toBe(true);
    expect(stored.map((r) => r.gridCell.cellKey).sort()).toEqual([...KEYS].sort());
    const block = await repo.getImergBlock(BLOCK);
    expect(block.rows).toHaveLength(60);
    // each pixel keeps its OWN value; the mean of the six (3.5 ... ) never appears
    const byCell = new Map();
    for (const r of block.rows) byCell.set(r.cellKey, new Set([...(byCell.get(r.cellKey) ?? []), r.precipMm]));
    expect([...byCell.get('1148:2700')]).toEqual([1]);
    expect([...byCell.get('1149:2702')]).toEqual([22]);
  });

  it('preserves the half-hourly count and the file version of every day', async () => {
    await ingest({
      listGranules: fakeGranules('2019-07-01', 4, (d) => (d < '2019-07-03' ? 'V07A' : 'V07B')),
      fetchDay: fakeFetchDay({ cntFor: (d, p) => (d === '2019-07-02' && p.col === 2700 ? 12 : 48) }),
    });
    const { rows } = await repo.getImergBlock(BLOCK);
    expect(rows.find((r) => r.cellKey === '1148:2700' && r.date === '2019-07-02')).toMatchObject({ precipitationCnt: 12, fileVersion: 'V07A' });
    expect(rows.find((r) => r.cellKey === '1148:2701' && r.date === '2019-07-04')).toMatchObject({ precipitationCnt: 48, fileVersion: 'V07B' });
  });

  it('stores the collection version (07) apart from the file versions (V07A, V07B)', async () => {
    await ingest({ listGranules: fakeGranules('2019-07-01', 4, (d) => (d < '2019-07-03' ? 'V07A' : 'V07B')), fetchDay: fakeFetchDay() });
    const [run] = await runs('SUCCESS');
    expect(run.requestParams.collection).toEqual({ shortName: 'GPM_3IMERGDF', collectionVersion: '07' });
    expect(run.requestParams.fileVersions).toEqual(['V07A', 'V07B']);
    expect(run.requestParams.versionNote).toMatch(/collection/i);
    expect(run.requestParams.aggregation).toMatch(/none/);
    expect(run.requestParams.variables).toEqual(['precipitation', 'precipitation_cnt']);
    expect(run.product).toMatch(/collection version 07/);
    expect(run.units.precipitationCnt).toMatch(/half-hourly/);
  });

  it('stores a missing pixel-day as null, never zero, and keeps a real zero as 0', async () => {
    await ingest({ listGranules: fakeGranules('2019-07-01', 2), fetchDay: fakeFetchDay({ valueFor: (d, p) => (d === '2019-07-01' ? null : (p.col === 2700 ? 0 : 5)) }) });
    const { rows } = await repo.getImergBlock(BLOCK);
    expect(rows.filter((r) => r.date === '2019-07-01').every((r) => r.precipMm === null)).toBe(true);
    expect(rows.find((r) => r.date === '2019-07-02' && r.cellKey === '1148:2700').precipMm).toBe(0);
    const [run] = await runs('SUCCESS');
    expect(run.missingCount).toBe(1);
  });

  it('resumes by APPENDING: only missing days are fetched and the same runs grow', async () => {
    await ingest({ listGranules: fakeGranules('2019-07-01', 5), fetchDay: fakeFetchDay() });
    const before = (await runs('SUCCESS')).map((r) => r.id).sort();
    const second = fakeFetchDay();
    const result = await ingest({ listGranules: fakeGranules('2019-07-01', 8), fetchDay: second });
    expect(result).toMatchObject({ ok: true, fetched: 3 });
    expect(second.calls).toEqual(['2019-07-06', '2019-07-07', '2019-07-08']);
    const after = await runs('SUCCESS');
    expect(after.map((r) => r.id).sort()).toEqual(before);
    expect(after.every((r) => r.rowCount === 8 && r.endDate.toISOString().slice(0, 10) === '2019-07-08')).toBe(true);
    const again = await ingest({ listGranules: fakeGranules('2019-07-01', 8), fetchDay: fakeFetchDay() });
    expect(again).toMatchObject({ ok: true, skipped: true, reason: 'already_covered' });
  });

  it('leaves a failed day out and retries it next time', async () => {
    const first = await ingest({ listGranules: fakeGranules('2019-07-01', 10), fetchDay: fakeFetchDay({ failOn: (d) => d === '2019-07-04' }) });
    expect(first).toMatchObject({ ok: true, fetched: 9, failed: 1 });
    const retry = fakeFetchDay();
    await ingest({ listGranules: fakeGranules('2019-07-01', 10), fetchDay: retry });
    expect(retry.calls).toEqual(['2019-07-04']);
    expect((await runs('SUCCESS')).every((r) => r.rowCount === 10)).toBe(true);
  });

  it('stops and records a FAILED run when too many days fail, keeping what is stored', async () => {
    await ingest({ listGranules: fakeGranules('2019-07-01', 5), fetchDay: fakeFetchDay() });
    const result = await ingest({ listGranules: fakeGranules('2019-07-01', 15), fetchDay: fakeFetchDay({ failOn: () => true }) });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Too many days failed/);
    expect(await runs('FAILED')).toHaveLength(1);
    const kept = await runs('SUCCESS');
    expect(kept).toHaveLength(6);
    expect(kept.every((r) => r.rowCount === 5)).toBe(true);
  });

  it('stops at once on a refused token and records it', async () => {
    const fetchDay = fakeFetchDay({ fatalOn: () => true });
    const result = await ingest({ listGranules: fakeGranules('2019-07-01', 50), fetchDay, concurrency: 2 });
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toMatch(/rejected the token/);
    expect(fetchDay.calls.length).toBeLessThanOrEqual(2);
    expect(await runs('SUCCESS')).toHaveLength(0);
    expect(await runs('FAILED')).toHaveLength(1);
  });

  it('does not touch the NASA POWER run of any cell', async () => {
    const powerCell = await prisma.climateGridCell.upsert({
      where: { provider_cellKey: { provider: 'NASA POWER', cellKey: '51:432' } },
      update: {},
      create: { provider: 'NASA POWER', cellKey: '51:432', gridName: 'test', centerLat: 25.5, centerLon: 90, resLatDeg: 0.5, resLonDeg: 0.625 },
    });
    const powerRun = await prisma.datasetRun.create({
      data: { source: 'NASA POWER', product: 'TEST FIXTURE', isSynthetic: false, status: 'SUCCESS', endpointUrl: 'fake://', requestParams: {}, startDate: new Date('2019-01-01T00:00:00Z'), endDate: new Date('2019-01-02T00:00:00Z'), gridCellId: powerCell.id },
    });
    try {
      await ingest({ listGranules: fakeGranules('2019-07-01', 3), fetchDay: fakeFetchDay() });
      expect(await prisma.datasetRun.findUnique({ where: { id: powerRun.id } })).not.toBeNull();
      expect((await repo.getClimateByCell({ provider: 'NASA POWER', cellKey: '51:432' })).provenance.source).toBe('NASA POWER');
    } finally {
      await prisma.datasetRun.deleteMany({ where: { id: powerRun.id } });
      await prisma.climateGridCell.deleteMany({ where: { id: powerCell.id } });
    }
  });

  it('reads back only the pixels of the requested block, and null when none are stored', async () => {
    expect(await repo.getImergBlock(BLOCK)).toBeNull();
    await ingest({ listGranules: fakeGranules('2019-07-01', 3), fetchDay: fakeFetchDay() });
    const one = await repo.getImergBlock({ rows: { first: 1149, last: 1149, count: 1 }, cols: { first: 2701, last: 2701, count: 1 }, pixelCount: 1, bounds: {} });
    expect(one.runs.map((r) => r.cellKey)).toEqual(['1149:2701']);
    expect(one.rows).toHaveLength(3);
    expect(one.pixelsExpected).toBe(1);
  });

  it('can ingest a single pixel chosen by a point', async () => {
    const block = imergBlockForPoint(24.9, 90.1);
    const key = imergPixelList(block)[0].cellKey;
    try {
      const result = await ingestImergBlock({ prisma, block, startDate: '2019-07-01', endDate: '2019-07-03', listGranules: fakeGranules('2019-07-01', 3), fetchDay: fakeFetchDay() });
      expect(result).toMatchObject({ ok: true, pixels: 1, fetched: 3 });
      const stored = await prisma.datasetRun.findMany({ where: { gridCell: { provider: IMERG_PROVIDER, cellKey: key } } });
      expect(stored).toHaveLength(1);
    } finally {
      await prisma.datasetRun.deleteMany({ where: { gridCell: { provider: IMERG_PROVIDER, cellKey: key } } });
      await prisma.climateGridCell.deleteMany({ where: { provider: IMERG_PROVIDER, cellKey: key } });
      await prisma.$executeRaw`DELETE FROM "DatasetIngestionLock" WHERE "key" LIKE ${`${imergLockKey(block)}%`}`;
    }
  });

  it('reports no granules in the range without writing anything', async () => {
    const result = await ingest({ listGranules: async () => ({ granules: [], skipped: 0 }), fetchDay: fakeFetchDay() });
    expect(result).toMatchObject({ ok: true, skipped: true, reason: 'no_granules_in_range' });
    expect(await runs('SUCCESS')).toHaveLength(0);
    expect(await runs('FAILED')).toHaveLength(0);
  });

  it('skips when the block lock is held', async () => {
    const held = await withIngestionLock(prisma, imergLockKey(BLOCK), async () => ingest({ listGranules: fakeGranules('2019-07-01', 3), fetchDay: fakeFetchDay() }));
    expect(held.locked).toBe(true);
    expect(held.value).toMatchObject({ ok: false, skipped: true });
    expect(await runs('SUCCESS')).toHaveLength(0);
  });
});

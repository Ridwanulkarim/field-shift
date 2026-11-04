// Database tests for the NASA POWER ingestion pipeline. They use a FAKE fetcher: no network, and the data
// is never labelled as live NASA data. Skipped unless TEST_DATABASE_URL points at a throw-away test database.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createPrismaClient } from '../src/data/prisma.js';
import { ingestDistrict, refreshDistrict } from '../src/integrations/nasa/ingest.js';
import { storeRun, storeMergedRun, withIngestionLock } from '../src/data/climateStore.js';
import { powerCellFor } from '../src/geo/climateGrid.js';

const url = process.env.TEST_DATABASE_URL;
const SLUG = 'zz-ingest-test';

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const fromCompact = (c) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

function days(start, end, { precip = 1, nullPrecipOn = [] } = {}) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({ date: d, precipMm: nullPrecipOn.includes(d) ? null : precip, tMaxC: 32, tMinC: 22 });
  }
  return out;
}

function parsed(list, missing = 0) {
  return {
    days: list, fillValue: -999, units: { PRECTOTCORR: 'mm/day' },
    missing: { PRECTOTCORR: missing, T2M_MAX: 0, T2M_MIN: 0 },
    warnings: [], product: 'TEST FIXTURE (not NASA data)', sources: null, apiVersion: 'test', timeStandard: 'LST',
  };
}

// Fake fetcher: returns the requested date range, with options to fail, delay or blank values.
function fakeFetch(opts = {}) {
  const calls = [];
  const fn = async ({ startDate, endDate }) => {
    calls.push({ startDate, endDate });
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.fail) throw new Error(opts.fail);
    const list = days(fromCompact(startDate), fromCompact(endDate), { precip: opts.precip ?? 1 });
    if (opts.nullShare) list.slice(0, Math.ceil(list.length * opts.nullShare)).forEach((d) => { d.precipMm = null; });
    return { url: 'fake://', parsed: parsed(list, list.filter((d) => d.precipMm === null).length) };
  };
  fn.calls = calls;
  return fn;
}

describe.skipIf(!url)('NASA POWER ingestion against the database (fake fetcher)', () => {
  let prisma;
  let district;
  const successRuns = () => prisma.datasetRun.findMany({ where: { districtId: district.id, status: 'SUCCESS' } });
  const failedRuns = () => prisma.datasetRun.findMany({ where: { districtId: district.id, status: 'FAILED' } });

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    district = await prisma.district.create({
      data: { slug: SLUG, nameEn: 'Ingest', nameBn: 'ইনজেস্ট', division: 'Test', latitude: 24.37, longitude: 88.6, coordNote: 'test' },
    });
  });

  beforeEach(async () => {
    await prisma.datasetRun.deleteMany({ where: { districtId: district.id } });
    await prisma.$executeRaw`DELETE FROM "DatasetIngestionLock" WHERE "key" LIKE ${`NASA POWER:${district.id}%`}`;
  });

  afterAll(async () => {
    await prisma.datasetRun.deleteMany({ where: { districtId: district.id } });
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    const { cellKey } = powerCellFor(24.37, 88.6); // the test district's cell; removed only if no run uses it
    await prisma.$executeRaw`DELETE FROM "ClimateGridCell" c WHERE c."cellKey" = ${cellKey} AND c."provider" = 'NASA POWER' AND NOT EXISTS (SELECT 1 FROM "DatasetRun" r WHERE r."gridCellId" = c."id")`;
    await prisma.$disconnect();
  });

  it('stores a run with its daily rows and provenance', async () => {
    const result = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2021, fetchPower: fakeFetch() });
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(731);
    const [run] = await successRuns();
    expect(run.source).toBe('NASA POWER');
    expect(run.isSynthetic).toBe(false);
    expect(run.rowCount).toBe(731);
    expect(run.requestParams.latitude).toBe(24.37);
    expect(await prisma.climateDaily.count({ where: { runId: run.id } })).toBe(731);
  });

  it('records the grid cell that contains the district point on every stored run, full or refreshed', async () => {
    const expected = powerCellFor(district.latitude, district.longitude);
    const full = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower: fakeFetch() });
    expect(full.ok).toBe(true);
    let run = (await successRuns())[0];
    let cell = await prisma.climateGridCell.findUnique({ where: { id: run.gridCellId } });
    expect(cell).toMatchObject({ provider: 'NASA POWER', cellKey: expected.cellKey, centerLat: expected.centerLat, centerLon: expected.centerLon });

    const refreshed = await refreshDistrict({ prisma, district, fetchPower: fakeFetch() });
    expect(refreshed.ok).toBe(true);
    run = (await successRuns())[0];
    expect(run.gridCellId).toBe(cell.id); // a merged (refreshed) run keeps its cell
  });

  it('records a failure, keeps the earlier good data, and releases the lock', async () => {
    await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2021, fetchPower: fakeFetch() });
    const [good] = await successRuns();

    const failed = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2022, fetchPower: fakeFetch({ fail: 'NASA POWER answered HTTP 503.' }) });
    expect(failed.ok).toBe(false);
    expect((await failedRuns())).toHaveLength(1);
    const still = await successRuns();
    expect(still.map((r) => r.id)).toEqual([good.id]);
    expect(await prisma.climateDaily.count({ where: { runId: good.id } })).toBe(731);

    const retry = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2021, fetchPower: fakeFetch() });
    expect(retry.ok).toBe(true); // lock was released after the failure
  });

  it('refuses data with too many missing values and stores nothing', async () => {
    const result = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower: fakeFetch({ nullShare: 0.5 }) });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Too much missing data/);
    expect(await successRuns()).toHaveLength(0);
    expect(await failedRuns()).toHaveLength(1);
  });

  it('keeps missing values as null and never turns them into zero', async () => {
    const fetchPower = async ({ startDate, endDate }) => {
      const list = days(fromCompact(startDate), fromCompact(endDate), { nullPrecipOn: ['2020-03-05'] });
      return { parsed: parsed(list, 1) };
    };
    await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower });
    const [run] = await successRuns();
    const row = await prisma.climateDaily.findFirst({ where: { runId: run.id, date: new Date('2020-03-05T00:00:00Z') } });
    expect(row.precipMm).toBeNull();
  });

  it('refresh extends the stored series, keeps older days, and leaves one successful run', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    const oldStart = addDays(oldEnd, -59);
    await storeRun(prisma, {
      districtId: district.id,
      days: days(oldStart, oldEnd, { precip: 5 }),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: oldStart, endDate: oldEnd, product: 'TEST FIXTURE' },
    });
    const fetchPower = fakeFetch({ precip: 9 });
    const result = await refreshDistrict({ prisma, district, fetchPower });
    expect(result.ok).toBe(true);

    const runs = await successRuns();
    expect(runs).toHaveLength(1);
    expect(iso(runs[0].startDate)).toBe(oldStart);
    expect(iso(runs[0].endDate)).toBe(addDays(today, -7));
    // The request overlapped the old data by 2 days, not the whole history.
    expect(fromCompact(fetchPower.calls[0].startDate)).toBe(addDays(oldEnd, -2));

    const first = await prisma.climateDaily.findFirst({ where: { runId: runs[0].id, date: new Date(`${oldStart}T00:00:00Z`) } });
    expect(first.precipMm).toBe(5); // older day preserved
    const last = await prisma.climateDaily.findFirst({ where: { runId: runs[0].id, date: new Date(`${addDays(today, -7)}T00:00:00Z`) } });
    expect(last.precipMm).toBe(9); // new day added
    expect(await prisma.climateDaily.count({ where: { runId: runs[0].id } })).toBe(runs[0].rowCount);
  });

  it('refresh with a failing fetch records the failure and keeps the existing run', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    const oldStart = addDays(oldEnd, -9);
    const stored = await storeRun(prisma, {
      districtId: district.id, days: days(oldStart, oldEnd),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: oldStart, endDate: oldEnd },
    });
    const result = await refreshDistrict({ prisma, district, fetchPower: fakeFetch({ fail: 'timeout' }) });
    expect(result.ok).toBe(false);
    expect((await successRuns()).map((r) => r.id)).toEqual([stored.id]);
    expect(await failedRuns()).toHaveLength(1);
  });

  it('refresh reports already_current when there is nothing new to fetch', async () => {
    const today = iso(new Date());
    const end = addDays(today, -7);
    await storeRun(prisma, {
      districtId: district.id, days: days(addDays(end, -9), end),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(end, -9), endDate: end },
    });
    const fetchPower = fakeFetch();
    const result = await refreshDistrict({ prisma, district, fetchPower, overlapDays: 0, lagDays: 7 });
    expect(result.ok).toBe(true);
    expect(fetchPower.calls.length).toBeLessThanOrEqual(1);
  });

  it('two simultaneous ingestions of one district: one runs, one is skipped', async () => {
    const fetchPower = fakeFetch({ delayMs: 300 });
    const results = await Promise.all([
      ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower }),
      ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.skipped)).toHaveLength(1);
    expect(fetchPower.calls).toHaveLength(1);
    expect(await successRuns()).toHaveLength(1);
  });

  it('a full ingest and a refresh of the same district cannot run at the same time', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    await storeRun(prisma, {
      districtId: district.id, days: days(addDays(oldEnd, -9), oldEnd),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(oldEnd, -9), endDate: oldEnd },
    });
    const slow = fakeFetch({ delayMs: 300 });
    const results = await Promise.all([
      ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower: slow }),
      refreshDistrict({ prisma, district, fetchPower: slow }),
    ]);
    expect(results.filter((r) => r.skipped)).toHaveLength(1);
    expect(await successRuns()).toHaveLength(1);
  });

  it('refresh while the lock is held is skipped and leaves the stored run untouched', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    const stored = await storeRun(prisma, {
      districtId: district.id, days: days(addDays(oldEnd, -9), oldEnd),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(oldEnd, -9), endDate: oldEnd },
    });
    const fetchPower = fakeFetch();
    const held = await withIngestionLock(prisma, `NASA POWER:${district.id}`, async () => refreshDistrict({ prisma, district, fetchPower }));
    expect(held.locked).toBe(true);
    expect(held.value.skipped).toBe(true); // the refresh could not take the same district lock
    expect(fetchPower.calls).toHaveLength(0);
    expect((await successRuns()).map((r) => r.id)).toEqual([stored.id]);
  });

  it('refresh after a full ingest extends the NEW full history instead of replacing it', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    await storeRun(prisma, {
      districtId: district.id, days: days(addDays(oldEnd, -9), oldEnd),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(oldEnd, -9), endDate: oldEnd },
    });
    const full = await ingestDistrict({ prisma, district, startYear: 2020, endYear: 2020, fetchPower: fakeFetch() });
    expect(full.ok).toBe(true);
    const result = await refreshDistrict({ prisma, district, fetchPower: fakeFetch() });
    expect(result.ok).toBe(true);
    const runs = await successRuns();
    expect(runs).toHaveLength(1);
    expect(iso(runs[0].startDate)).toBe('2020-01-01'); // the full 2020 history survived the refresh
    expect(runs[0].rowCount).toBeGreaterThan(366);
  });

  it('refuses to store a merge when the previous run has vanished, and keeps the existing data', async () => {
    const today = iso(new Date());
    const oldEnd = addDays(today, -30);
    const stored = await storeRun(prisma, {
      districtId: district.id, days: days(addDays(oldEnd, -9), oldEnd),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(oldEnd, -9), endDate: oldEnd },
    });
    const ghostRunId = stored.id + 1_000_000;
    await expect(storeMergedRun(prisma, {
      districtId: district.id, previousRunId: ghostRunId, days: days(addDays(oldEnd, 1), addDays(oldEnd, 3)),
      run: { source: 'NASA POWER', isSynthetic: false, endpointUrl: 'fake://', requestParams: {}, startDate: addDays(oldEnd, 1), endDate: addDays(oldEnd, 3) },
    })).rejects.toThrow(/no stored rows/);
    const runs = await successRuns();
    expect(runs.map((r) => r.id)).toEqual([stored.id]);
    expect(runs[0].rowCount).toBe(10);
  });

  it('only the lock owner releases the lock, and a stale lock can be taken over', async () => {
    const key = `NASA POWER:${district.id}:locktest`;
    const inner = await withIngestionLock(prisma, key, async () => withIngestionLock(prisma, key, async () => 'never'));
    expect(inner.locked).toBe(true);
    expect(inner.value.locked).toBe(false); // second attempt while held is refused

    await prisma.$executeRaw`INSERT INTO "DatasetIngestionLock" ("key","owner","acquiredAt") VALUES (${key}, gen_random_uuid(), CURRENT_TIMESTAMP - INTERVAL '2 hours')`;
    const taken = await withIngestionLock(prisma, key, async () => 'ok');
    expect(taken).toEqual({ locked: true, value: 'ok' });
  });
});
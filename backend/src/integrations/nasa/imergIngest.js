// Ingests NASA GPM IMERG daily precipitation at its NATIVE 0.1 degree resolution. Every pixel is stored as a grid cell of
// its own (provider "NASA GPM IMERG", key "<row>:<col>") with its own run (districtId = null, source "NASA GPM IMERG").
// Nothing is averaged here and nothing depends on the NASA POWER grid: a POWER cell (or a point) is only used to choose
// WHICH pixels to read. Comparing IMERG with POWER is a separate, read-time operation (science/imergAggregation.js).
//
// Per pixel and day the following is stored: `precipMm` (null when the pixel was missing, never zero) and, in
// `measurements`, `precipitationCnt` (valid half-hourly samples behind the value) and `fileVersion` (the V07A/V07B letter of
// that day's file). The collection version "07" and the version note are stored on the run.
//
// How it works:
//   1. list the daily granules in the date range from NASA CMR (public);
//   2. skip the days every pixel of the block already has, so a re-run only fetches what is missing (this is also how the
//      data is brought up to date as new Final-Run days are published);
//   3. fetch the missing days a few at a time, in batches (one request returns the whole block); after each batch the new
//      days are appended to every pixel's run, so an interrupted run keeps its progress;
//   4. a day that fails is left out and retried next time. If too many days in a batch fail, or the token is refused, the
//      run stops and a FAILED run is recorded (the data already stored is kept).

import { ensureGridCell, recordFailedRun, storeRun, withIngestionLock } from '../../data/climateStore.js';
import { imergPixelList } from '../../geo/imergGrid.js';
import { IMERG_COLLECTION, IMERG_CMR_URL, IMERG_FILL_VALUE, IMERG_SOURCE } from './imerg.js';

const MAX_FAILED_SHARE = 0.2;
const LOCK_STALE_MINUTES = 240; // a long ingestion must not have its lock taken over

export const imergLockKey = (block) => `${IMERG_SOURCE}:block:r${block.rows.first}-${block.rows.last}:c${block.cols.first}-${block.cols.last}`;

const iso = (d) => d.toISOString().slice(0, 10);

function runMeta(pixel, block) {
  return {
    source: IMERG_SOURCE,
    isSynthetic: false,
    product: `GPM IMERG Final Run daily (${IMERG_COLLECTION.shortName}, collection version ${IMERG_COLLECTION.collectionVersion}): precipitation at native 0.1 degree resolution, one pixel`,
    endpointUrl: IMERG_CMR_URL,
    fillValue: IMERG_FILL_VALUE,
    units: {
      precipMm: 'mm/day',
      precipitationCnt: 'count of valid half-hourly samples behind the daily value (integer 0-48; see NASA variable attributes)',
    },
    notes: 'Daily files read from GES DISC through NASA Earthdata OPeNDAP (DAP4). IMERG Final is delayed by up to about 4 months, so the newest months are absent. No spatial aggregation was applied.',
    requestParams: {
      collection: { shortName: IMERG_COLLECTION.shortName, collectionVersion: IMERG_COLLECTION.collectionVersion },
      versionNote: IMERG_COLLECTION.versionNote,
      fileVersions: [], // distinct V07x letters seen in the stored days; each day's own letter is in measurements.fileVersion
      variables: ['precipitation', 'precipitation_cnt'],
      pixel: { provider: pixel.provider, cellKey: pixel.cellKey, row: pixel.row, col: pixel.col, centerLat: pixel.centerLat, centerLon: pixel.centerLon, resolutionDeg: 0.1 },
      requestedBlock: { rows: [block.rows.first, block.rows.last], cols: [block.cols.first, block.cols.last] },
      aggregation: 'none (native pixel values)',
    },
  };
}

// Adds new days to an existing pixel run (rows already present are left alone), then refreshes the run's summary fields.
async function appendRunDays(prisma, runId, rows, fileVersions) {
  return prisma.$transaction(async (tx) => {
    await tx.climateDaily.createMany({
      data: rows.map((d) => ({ runId, districtId: null, date: new Date(`${d.date}T00:00:00Z`), precipMm: d.precipMm, tMaxC: null, tMinC: null, measurements: d.measurements })),
      skipDuplicates: true,
    });
    const [agg, nulls, run] = await Promise.all([
      tx.climateDaily.aggregate({ where: { runId }, _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
      tx.climateDaily.count({ where: { runId, precipMm: null } }),
      tx.datasetRun.findUnique({ where: { id: runId }, select: { requestParams: true } }),
    ]);
    const seen = new Set([...(run.requestParams.fileVersions ?? []), ...fileVersions]);
    return tx.datasetRun.update({
      where: { id: runId },
      data: {
        rowCount: agg._count._all,
        startDate: agg._min.date,
        endDate: agg._max.date,
        missingCount: nulls,
        retrievedAt: new Date(),
        requestParams: { ...run.requestParams, fileVersions: [...seen].sort() },
      },
    });
  }, { timeout: 120000, maxWait: 30000 });
}

// Runs `worker` over `items` with at most `limit` in flight at once. Results keep the input order. If any worker throws,
// no new item is started (requests already in flight finish) and the first error is rethrown.
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  let failure = null;
  async function lane() {
    while (next < items.length && failure === null) {
      const i = next;
      next += 1;
      try {
        results[i] = await worker(items[i]);
      } catch (err) {
        failure ??= err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  if (failure) throw failure;
  return results;
}

// `block` is a pixel block: { rows: {first,last,count}, cols: {first,last,count}, pixelCount } as returned by
// imergPixelsInCell (the pixels inside a POWER cell) or imergBlockForPoint (one pixel).
export async function ingestImergBlock({
  prisma, block, startDate, endDate, listGranules, fetchDay, concurrency = 4, batchDays = 365, onProgress = () => {},
}) {
  const pixels = imergPixelList(block);
  const result = await withIngestionLock(prisma, imergLockKey(block), async () => {
    const cells = new Map();
    for (const p of pixels) cells.set(p.cellKey, await ensureGridCell(prisma, p));
    const failureCell = cells.get(pixels[0].cellKey);
    try {
      const { granules } = await listGranules({ startDate, endDate });
      if (granules.length === 0) return { ok: true, skipped: true, reason: 'no_granules_in_range', pixels: pixels.length };

      // What is already stored, per pixel.
      const runs = await prisma.datasetRun.findMany({
        where: { gridCellId: { in: [...cells.values()].map((c) => c.id) }, source: IMERG_SOURCE, isSynthetic: false, status: 'SUCCESS' },
        orderBy: [{ retrievedAt: 'desc' }, { id: 'desc' }],
      });
      const runByCell = new Map();
      for (const r of runs) if (!runByCell.has(r.gridCellId)) runByCell.set(r.gridCellId, r.id);
      const have = new Map(pixels.map((p) => [p.cellKey, new Set()]));
      const cellKeyById = new Map([...cells].map(([key, c]) => [c.id, key]));
      if (runByCell.size > 0) {
        const runIds = [...runByCell.values()];
        const owner = new Map([...runByCell].map(([cellId, runId]) => [runId, cellKeyById.get(cellId)]));
        const rows = await prisma.climateDaily.findMany({ where: { runId: { in: runIds } }, select: { runId: true, date: true } });
        for (const r of rows) have.get(owner.get(r.runId)).add(iso(r.date));
      }

      const todo = granules.filter((g) => pixels.some((p) => !have.get(p.cellKey).has(g.date)));
      if (todo.length === 0) return { ok: true, skipped: true, reason: 'already_covered', pixels: pixels.length };

      let fetched = 0;
      let failed = 0;
      let through = null;
      for (let i = 0; i < todo.length; i += batchDays) {
        const batch = todo.slice(i, i + batchDays);
        const outcomes = await mapLimit(batch, concurrency, async (granule) => {
          try {
            const { pixels: day } = await fetchDay({ granule, block });
            return { ok: true, granule, day };
          } catch (err) {
            if (err.fatal) throw err; // stops the whole run
            return { ok: false, granule, error: err.message };
          }
        });
        const good = outcomes.filter((o) => o.ok);
        const bad = outcomes.filter((o) => !o.ok);
        if (bad.length > MAX_FAILED_SHARE * batch.length) {
          throw new Error(`Too many days failed (${bad.length} of ${batch.length}); first error: ${bad[0].error}`);
        }
        failed += bad.length;
        fetched += good.length;

        for (const p of pixels) {
          const rows = [];
          const versions = new Set();
          for (const o of good) {
            if (have.get(p.cellKey).has(o.granule.date)) continue;
            const px = o.day.find((d) => d.row === p.row && d.col === p.col);
            if (!px) throw new Error(`The response for ${o.granule.date} did not contain pixel ${p.cellKey}.`);
            rows.push({ date: o.granule.date, precipMm: px.precipMm, measurements: { precipitationCnt: px.precipitationCnt, fileVersion: px.fileVersion } });
            if (px.fileVersion) versions.add(px.fileVersion);
          }
          if (rows.length === 0) continue;
          rows.sort((a, b) => a.date.localeCompare(b.date));
          const cell = cells.get(p.cellKey);
          const existingRunId = runByCell.get(cell.id);
          if (existingRunId) {
            await appendRunDays(prisma, existingRunId, rows, versions);
          } else {
            const meta = runMeta(p, block);
            meta.requestParams.fileVersions = [...versions].sort();
            const created = await storeRun(prisma, {
              districtId: null,
              days: rows.map((d) => ({ ...d, tMaxC: null, tMinC: null })),
              run: { ...meta, gridCellId: cell.id, startDate: rows[0].date, endDate: rows[rows.length - 1].date, missingCount: rows.filter((d) => d.precipMm === null).length },
            });
            runByCell.set(cell.id, created.id);
          }
          for (const d of rows) have.get(p.cellKey).add(d.date);
        }
        if (good.length > 0) through = good.map((o) => o.granule.date).sort().at(-1);
        onProgress({ done: Math.min(i + batchDays, todo.length), total: todo.length, failed });
      }
      return { ok: true, pixels: pixels.length, fetched, failed, through };
    } catch (err) {
      await recordFailedRun(prisma, {
        run: { ...runMeta(pixels[0], block), gridCellId: failureCell.id, startDate, endDate },
        errorMessage: err.message,
      });
      return { ok: false, error: err.message, pixels: pixels.length };
    }
  }, { staleAfterMinutes: LOCK_STALE_MINUTES });
  return result.locked ? result.value : { ok: false, skipped: true, error: 'An IMERG ingestion for this pixel block is already running.', pixels: pixels.length };
}

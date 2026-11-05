// Stores one dataset run (provenance) together with its daily rows, and retires the older
// run of the same source and kind for that district or standalone provider grid cell.

import crypto from 'node:crypto';
import { powerCellFor } from '../geo/climateGrid.js';

const CHUNK = 3000; // 3000 rows x 8 columns stays far below PostgreSQL's 65,535-parameter limit

export async function withIngestionLock(prisma, key, work, { staleAfterMinutes = 30 } = {}) {
  const owner = crypto.randomUUID();
  const acquired = await prisma.$queryRaw`
    INSERT INTO "DatasetIngestionLock" ("key", "owner")
    VALUES (${key}, ${owner}::uuid)
    ON CONFLICT ("key") DO UPDATE
      SET "owner" = EXCLUDED."owner", "acquiredAt" = CURRENT_TIMESTAMP
      WHERE "DatasetIngestionLock"."acquiredAt" < CURRENT_TIMESTAMP - (${staleAfterMinutes} * INTERVAL '1 minute')
    RETURNING "owner"
  `;
  if (acquired.length === 0) return { locked: false, value: null };
  try {
    return { locked: true, value: await work() };
  } finally {
    await prisma.$executeRaw`
      DELETE FROM "DatasetIngestionLock"
      WHERE "key" = ${key} AND "owner" = ${owner}::uuid
    `;
  }
}

// Which runs a new run replaces. EXACTLY one scope applies: a district run replaces that district's older
// runs; a standalone cell run (no district) replaces that cell's older cell runs. A run with neither is
// refused BEFORE anything is written, so a delete can never match more runs than intended.
export function runScope({ districtId = null, gridCellId = null }) {
  if (districtId !== null && districtId !== undefined) {
    if (!Number.isInteger(districtId)) throw new Error('districtId must be an integer.');
    return { districtId };
  }
  if (Number.isInteger(gridCellId)) return { districtId: null, gridCellId };
  throw new Error('A run needs a districtId or, for a standalone cell run, a gridCellId.');
}

export async function storeRun(prisma, { districtId, run, days }) {
  const scope = runScope({ districtId, gridCellId: run.gridCellId ?? null });
  return prisma.$transaction(
    async (tx) => {
      const created = await tx.datasetRun.create({
        data: {
          districtId: districtId ?? null,
          source: run.source,
          product: run.product ?? null,
          isSynthetic: run.isSynthetic,
          status: 'SUCCESS',
          endpointUrl: run.endpointUrl,
          requestParams: run.requestParams,
          startDate: new Date(`${run.startDate}T00:00:00Z`),
          endDate: new Date(`${run.endDate}T00:00:00Z`),
          fillValue: run.fillValue ?? null,
          units: run.units ?? undefined,
          rowCount: days.length,
          missingCount: run.missingCount ?? 0,
          notes: run.notes ?? null,
          gridCellId: run.gridCellId ?? null,
        },
      });
      for (let i = 0; i < days.length; i += CHUNK) {
        await tx.climateDaily.createMany({
          data: days.slice(i, i + CHUNK).map((d) => ({
            runId: created.id,
            districtId: districtId ?? null,
            date: new Date(`${d.date}T00:00:00Z`),
            precipMm: d.precipMm,
            tMaxC: d.tMaxC,
            tMinC: d.tMinC,
            measurements: d.measurements ?? undefined,
          })),
        });
      }

      await tx.datasetRun.deleteMany({
        where: {
          ...scope,
          source: run.source,
          isSynthetic: run.isSynthetic,
          status: 'SUCCESS',
          id: { not: created.id },
        },
      });
      return created;
    },
    { timeout: 180000, maxWait: 30000 },
  );
}

export async function storeMergedRun(prisma, { districtId, previousRunId, run, days }) {
  const previous = await prisma.climateDaily.findMany({
    where: { runId: previousRunId },
    orderBy: { date: 'asc' },
    select: { date: true, precipMm: true, tMaxC: true, tMinC: true, measurements: true },
  });
  // Safety net: merging against an empty or missing previous run would replace the stored history
  // with only the few new days. Refuse instead of silently losing data.
  if (previous.length === 0) {
    throw new Error(`Previous run ${previousRunId} has no stored rows (it may have been replaced). Refresh not stored.`);
  }
  const merged = new Map(previous.map((row) => [row.date.toISOString().slice(0, 10), {
    date: row.date.toISOString().slice(0, 10),
    precipMm: row.precipMm,
    tMaxC: row.tMaxC,
    tMinC: row.tMinC,
    measurements: row.measurements,
  }]));
  for (const day of days) {
    const previousDay = merged.get(day.date);
    merged.set(day.date, previousDay
      ? {
          ...previousDay,
          ...day,
          precipMm: day.precipMm ?? previousDay.precipMm,
          tMaxC: day.tMaxC ?? previousDay.tMaxC,
          tMinC: day.tMinC ?? previousDay.tMinC,
        }
      : day);
  }
  const allDays = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  return storeRun(prisma, {
    districtId,
    days: allDays,
    run: {
      ...run,
      startDate: allDays[0].date,
      endDate: allDays[allDays.length - 1].date,
      missingCount: allDays.reduce((count, day) => count + (day.precipMm === null ? 1 : 0) + (day.tMaxC === null ? 1 : 0) + (day.tMinC === null ? 1 : 0), 0),
    },
  });
}

// A failed attempt is recorded too, so a failure is visible and not silent.
export async function recordFailedRun(prisma, { districtId, run, errorMessage }) {
  return prisma.datasetRun.create({
    data: {
      districtId: districtId ?? null,
      source: run.source,
      product: run.product ?? null,
      isSynthetic: run.isSynthetic,
      status: 'FAILED',
      endpointUrl: run.endpointUrl,
      requestParams: run.requestParams,
      startDate: new Date(`${run.startDate}T00:00:00Z`),
      endDate: new Date(`${run.endDate}T00:00:00Z`),
      errorMessage: String(errorMessage).slice(0, 1000),
      gridCellId: run.gridCellId ?? null,
    },
  });
}

// Finds or creates the row for one provider grid cell (the shape returned by powerCellFor).
export async function ensureGridCell(prisma, cell) {
  return prisma.climateGridCell.upsert({
    where: { provider_cellKey: { provider: cell.provider, cellKey: cell.cellKey } },
    create: {
      provider: cell.provider,
      cellKey: cell.cellKey,
      gridName: cell.gridName,
      centerLat: cell.centerLat,
      centerLon: cell.centerLon,
      resLatDeg: cell.resLatDeg,
      resLonDeg: cell.resLonDeg,
    },
    update: {},
  });
}

// Sets gridCellId on real NASA POWER runs stored before cells were recorded. A run is placed in the cell that
// contains its district's reference point (the point that was sent to NASA). Safe to repeat: it only touches
// runs whose gridCellId is still null, and never changes climate values. `dryRun` reports without writing.
export async function backfillGridCells(prisma, { dryRun = false, districtId } = {}) {
  const runs = await prisma.datasetRun.findMany({
    where: { source: 'NASA POWER', isSynthetic: false, gridCellId: null, ...(districtId !== undefined ? { districtId } : {}) },
    select: { id: true, district: { select: { slug: true, latitude: true, longitude: true } } },
    orderBy: { id: 'asc' },
  });
  const summary = { runsFound: runs.length, runsUpdated: 0, cells: new Map() };
  for (const run of runs) {
    const cell = powerCellFor(run.district.latitude, run.district.longitude);
    const entry = summary.cells.get(cell.cellKey) ?? { cellKey: cell.cellKey, centerLat: cell.centerLat, centerLon: cell.centerLon, districts: new Set() };
    entry.districts.add(run.district.slug);
    summary.cells.set(cell.cellKey, entry);
    if (dryRun) continue;
    const stored = await ensureGridCell(prisma, cell);
    await prisma.datasetRun.update({ where: { id: run.id }, data: { gridCellId: stored.id } });
    summary.runsUpdated += 1;
  }
  summary.cells = [...summary.cells.values()].map((c) => ({ ...c, districts: [...c.districts].sort() }));
  return summary;
}

// ---- Cells that hold registered fields -------------------------------------------------------------

// Every distinct NASA POWER grid cell that contains the representative point of at least one registered field,
// with the number of fields in it. Fields without a boundary are ignored.
export async function listFieldCells(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT ST_Y(ST_PointOnSurface("boundary")) AS "lat", ST_X(ST_PointOnSurface("boundary")) AS "lon"
    FROM "Field"
    WHERE "boundary" IS NOT NULL
  `;
  const cells = new Map();
  for (const row of rows) {
    const cell = powerCellFor(Number(row.lat), Number(row.lon));
    const entry = cells.get(cell.cellKey) ?? { cell, fieldCount: 0 };
    entry.fieldCount += 1;
    cells.set(cell.cellKey, entry);
  }
  return [...cells.values()].sort((a, b) => a.cell.cellKey.localeCompare(b.cell.cellKey, undefined, { numeric: true }));
}

// Does this cell already have a successful REAL run for the source, from a district or a standalone ingestion?
export async function cellHasRealRun(prisma, cell, { source = 'NASA POWER' } = {}) {
  const run = await prisma.datasetRun.findFirst({
    where: { gridCell: { provider: cell.provider, cellKey: cell.cellKey }, status: 'SUCCESS', isSynthetic: false, source },
    select: { id: true },
  });
  return run !== null;
}

// Cells whose newest real run is a standalone cell run (no district). Used by the daily refresh, because a
// district's own refresh does not extend these.
export async function listStandaloneCellRuns(prisma) {
  const runs = await prisma.datasetRun.findMany({
    where: { districtId: null, source: 'NASA POWER', isSynthetic: false, status: 'SUCCESS', gridCellId: { not: null } },
    select: { gridCell: { select: { cellKey: true } } },
    distinct: ['gridCellId'],
  });
  return runs.map((r) => r.gridCell.cellKey);
}

// Ingests NASA POWER daily data for one district: fetch -> validate -> store with provenance.
// A failure is recorded as a FAILED run (visible at /api/health/data), never hidden.

import { fetchPowerDaily, POWER_BASE_URL, POWER_COMMUNITY, POWER_PARAMETERS } from './power.js';
import { storeRun, storeMergedRun, recordFailedRun, withIngestionLock, ensureGridCell } from '../../data/climateStore.js';
import { powerCellFor, POWER_GRID } from '../../geo/climateGrid.js';

// If any variable is missing on more than this share of days we refuse the data.
export const MAX_MISSING_SHARE = 0.2;

function compactDate(value) {
  return value.replaceAll('-', '');
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}


function validateIsoDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || Number(value.slice(0, 4)) < 1981) {
    throw new Error(`${label} must be a valid date from 1981 onward.`);
  }
}

function addDays(date, amount) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return isoDate(result);
}

// One lock per native provider cell coordinates district and standalone cell ingestion. A full ingest
// and incremental refresh for the same cell must never overlap, regardless of which entry point starts it.
export function ingestionLockKey(district) {
  return `NASA POWER:grid:${powerCellFor(district.latitude, district.longitude).cellKey}`;
}

function runBase(district, startDate, endDate) {
  return {
    source: 'NASA POWER',
    isSynthetic: false,
    endpointUrl: POWER_BASE_URL,
    requestParams: {
      parameters: POWER_PARAMETERS,
      community: POWER_COMMUNITY,
      latitude: district.latitude,
      longitude: district.longitude,
      start: compactDate(startDate),
      end: compactDate(endDate),
      format: 'JSON',
    },
    startDate,
    endDate,
  };
}

async function storeFetched({ prisma, district, fetchPower, startDate, endDate, previousRunId = null }) {
  const base = runBase(district, startDate, endDate);
  const { parsed } = await fetchPower({
    latitude: district.latitude,
    longitude: district.longitude,
    startDate: compactDate(startDate),
    endDate: compactDate(endDate),
  });
  const total = parsed.days.length;
  const worst = Math.max(...Object.values(parsed.missing)) / total;
  if (worst > MAX_MISSING_SHARE) {
    throw new Error(`Too much missing data (${Math.round(worst * 100)}% on the worst variable). Not stored.`);
  }
  const missingCount = Object.values(parsed.missing).reduce((a, b) => a + b, 0);
  const notes = [
    parsed.sources ? `Sources reported by NASA: ${JSON.stringify(parsed.sources)}` : null,
    parsed.apiVersion ? `POWER API version: ${parsed.apiVersion}` : null,
    parsed.timeStandard ? `Time standard: ${parsed.timeStandard}` : null,
    ...parsed.warnings,
  ].filter(Boolean).join(' | ');
  const run = {
    ...base,
    product: parsed.product,
    fillValue: parsed.fillValue,
    units: parsed.units,
    missingCount,
    startDate: parsed.days[0].date,
    endDate: parsed.days[total - 1].date,
    notes,
    // The grid cell that contains the district point NASA was asked about.
    gridCellId: (await ensureGridCell(prisma, powerCellFor(district.latitude, district.longitude))).id,
  };
  const stored = previousRunId
    ? await storeMergedRun(prisma, { districtId: district.id, previousRunId, days: parsed.days, run })
    : await storeRun(prisma, { districtId: district.id, days: parsed.days, run });
  return { runId: stored.id, rows: total, missingCount, warnings: parsed.warnings };
}

export async function ingestDistrict({ prisma, district, startYear, endYear, fetchPower = fetchPowerDaily }) {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear < 1981 || endYear < startYear) {
    throw new Error('Invalid NASA POWER ingestion year range.');
  }
  const startDate = `${startYear}0101`;
  const endDate = `${endYear}1231`;
  const key = ingestionLockKey(district);
  const result = await withIngestionLock(prisma, key, async () => {
    try {
      return { ok: true, ...(await storeFetched({ prisma, district, fetchPower, startDate: `${startYear}-01-01`, endDate: `${endYear}-12-31` })) };
    } catch (err) {
      await recordFailedRun(prisma, { districtId: district.id, run: runBase(district, `${startYear}-01-01`, `${endYear}-12-31`), errorMessage: err.message });
      return { ok: false, error: err.message };
    }
  });
  return result.locked ? result.value : { ok: false, skipped: true, error: 'An ingestion for this district is already running.' };
}

// Extends the stored series for one district. Everything, INCLUDING the lookup of the previous run,
// happens while holding the district lock. If the lookup happened before the lock, a full ingest that
// finished in between would delete that run, and the refresh would merge against nothing.
export async function refreshDistrict({ prisma, district, lagDays = 7, overlapDays = 2, fetchPower = fetchPowerDaily }) {
  const key = ingestionLockKey(district);
  const result = await withIngestionLock(prisma, key, async () => {
    const previous = await prisma.datasetRun.findFirst({
      where: { districtId: district.id, source: 'NASA POWER', isSynthetic: false, status: 'SUCCESS' },
      orderBy: { retrievedAt: 'desc' },
    });
    if (!previous) return { ok: false, skipped: true, error: 'No stored NASA POWER run exists for this district.' };
    const endDate = addDays(isoDate(new Date()), -lagDays);
    const startDate = addDays(isoDate(previous.endDate), -overlapDays);
    if (startDate > endDate) return { ok: true, skipped: true, reason: 'already_current', through: isoDate(previous.endDate) };
    try {
      return { ok: true, ...(await storeFetched({ prisma, district, fetchPower, startDate, endDate, previousRunId: previous.id })) };
    } catch (err) {
      await recordFailedRun(prisma, { districtId: district.id, run: runBase(district, startDate, endDate), errorMessage: err.message });
      return { ok: false, error: err.message };
    }
  });
  return result.locked ? result.value : { ok: false, skipped: true, error: 'An ingestion for this district is already running.' };
}

// Ingest a provider grid cell without requiring a district record. Coordinates are snapped to
// the native POWER cell centre before requesting data, so every field in the same cell shares a run.
export function gridCellIngestionLockKey(cell) {
  return `NASA POWER:grid:${cell.cellKey}`;
}

function gridRunBase(cell, startDate, endDate) {
  return {
    source: 'NASA POWER',
    isSynthetic: false,
    endpointUrl: POWER_BASE_URL,
    requestParams: {
      parameters: POWER_PARAMETERS,
      community: POWER_COMMUNITY,
      latitude: cell.centerLat,
      longitude: cell.centerLon,
      start: compactDate(startDate),
      end: compactDate(endDate),
      format: 'JSON',
      provider: cell.provider,
      gridName: cell.gridName,
      cellKey: cell.cellKey,
      resolutionDeg: { lat: cell.resLatDeg, lon: cell.resLonDeg },
    },
    startDate,
    endDate,
    gridCellId: null,
  };
}

async function storeFetchedGridCell({ prisma, cell, fetchPower, startDate, endDate, previousRunId = null }) {
  const base = gridRunBase(cell, startDate, endDate);
  const { parsed } = await fetchPower({
    latitude: cell.centerLat,
    longitude: cell.centerLon,
    startDate: compactDate(startDate),
    endDate: compactDate(endDate),
  });
  const total = parsed.days.length;
  const worst = Math.max(...Object.values(parsed.missing)) / total;
  if (worst > MAX_MISSING_SHARE) {
    throw new Error(`Too much missing data (${Math.round(worst * 100)}% on the worst variable). Not stored.`);
  }
  const missingCount = Object.values(parsed.missing).reduce((a, b) => a + b, 0);
  const notes = [
    parsed.sources ? `Sources reported by NASA: ${JSON.stringify(parsed.sources)}` : null,
    parsed.apiVersion ? `POWER API version: ${parsed.apiVersion}` : null,
    parsed.timeStandard ? `Time standard: ${parsed.timeStandard}` : null,
    ...parsed.warnings,
  ].filter(Boolean).join(' | ');
  const storedCell = await ensureGridCell(prisma, cell);
  const run = {
    ...base,
    gridCellId: storedCell.id,
    product: parsed.product,
    fillValue: parsed.fillValue,
    units: parsed.units,
    missingCount,
    startDate: parsed.days[0].date,
    endDate: parsed.days[total - 1].date,
    notes,
  };
  const stored = previousRunId
    ? await storeMergedRun(prisma, { districtId: null, previousRunId, days: parsed.days, run })
    : await storeRun(prisma, { districtId: null, days: parsed.days, run });
  return { runId: stored.id, cellKey: cell.cellKey, rows: total, missingCount, warnings: parsed.warnings };
}

export async function ingestGridCell({ prisma, latitude, longitude, cellKey, startDate, endDate, fetchPower = fetchPowerDaily }) {
  const cell = cellKey ? await resolvePowerCell(prisma, cellKey) : powerCellFor(latitude, longitude);
  validateIsoDate(startDate, 'startDate');
  validateIsoDate(endDate, 'endDate');
  if (startDate > endDate) throw new Error('startDate must not be after endDate.');
  const key = gridCellIngestionLockKey(cell);
  const result = await withIngestionLock(prisma, key, async () => {
    const cellFilter = { gridCell: { provider: cell.provider, cellKey: cell.cellKey }, source: 'NASA POWER', isSynthetic: false, status: 'SUCCESS' };
    const [covered, existing] = await Promise.all([
      prisma.datasetRun.findFirst({
        where: { ...cellFilter, startDate: { lte: new Date(`${startDate}T00:00:00Z`) }, endDate: { gte: new Date(`${endDate}T00:00:00Z`) } },
        orderBy: { retrievedAt: 'desc' },
      }),
      prisma.datasetRun.findFirst({ where: cellFilter, orderBy: { retrievedAt: 'desc' } }),
    ]);
    if (covered) return { ok: true, skipped: true, reason: 'already_covered', runId: covered.id, cellKey: cell.cellKey };
    try {
      return { ok: true, ...(await storeFetchedGridCell({ prisma, cell, fetchPower, startDate, endDate, previousRunId: existing?.id ?? null })) };
    } catch (err) {
      const failed = await ensureGridCell(prisma, cell);
      await recordFailedRun(prisma, { run: { ...gridRunBase(cell, startDate, endDate), gridCellId: failed.id }, errorMessage: err.message });
      return { ok: false, error: err.message, cellKey: cell.cellKey };
    }
  });
  return result.locked ? result.value : { ok: false, skipped: true, error: 'An ingestion for this grid cell is already running.', cellKey: cell.cellKey };
}

export async function refreshGridCell({ prisma, latitude, longitude, cellKey, lagDays = 7, overlapDays = 2, fetchPower = fetchPowerDaily }) {
  const cell = cellKey ? await resolvePowerCell(prisma, cellKey) : powerCellFor(latitude, longitude);
  const key = gridCellIngestionLockKey(cell);
  const result = await withIngestionLock(prisma, key, async () => {
    const previous = await prisma.datasetRun.findFirst({
      where: { gridCell: { provider: cell.provider, cellKey: cell.cellKey }, source: 'NASA POWER', isSynthetic: false, status: 'SUCCESS' },
      orderBy: { retrievedAt: 'desc' },
    });
    if (!previous) return { ok: false, skipped: true, error: 'No stored NASA POWER run exists for this grid cell.' };
    const endDate = addDays(isoDate(new Date()), -lagDays);
    const startDate = addDays(isoDate(previous.endDate), -overlapDays);
    if (startDate > endDate) return { ok: true, skipped: true, reason: 'already_current', through: isoDate(previous.endDate) };
    try {
      return { ok: true, ...(await storeFetchedGridCell({ prisma, cell, fetchPower, startDate, endDate, previousRunId: previous.id })) };
    } catch (err) {
      const storedCell = await ensureGridCell(prisma, cell);
      await recordFailedRun(prisma, { run: { ...gridRunBase(cell, startDate, endDate), gridCellId: storedCell.id }, errorMessage: err.message });
      return { ok: false, error: err.message, cellKey: cell.cellKey };
    }
  });
  return result.locked ? result.value : { ok: false, skipped: true, error: 'An ingestion for this grid cell is already running.', cellKey: cell.cellKey };
}

export async function resolvePowerCell(prisma, cellKey) {
  if (typeof cellKey !== 'string' || !/^-?\d+:-?\d+$/.test(cellKey)) throw new Error('cellKey must use the POWER <latIndex>:<lonIndex> format.');
  const [latIndex, lonIndex] = cellKey.split(':').map(Number);
  const latitude = latIndex * POWER_GRID.resLatDeg;
  const longitude = POWER_GRID.lonOrigin + lonIndex * POWER_GRID.resLonDeg;
  const cell = powerCellFor(latitude, longitude);
  if (cell.cellKey !== cellKey) throw new Error('cellKey is outside the supported NASA POWER grid.');
  return cell;
}

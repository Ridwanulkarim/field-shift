// Ingests NASA POWER daily data for one district: fetch -> validate -> store with provenance.
// A failure is recorded as a FAILED run (visible at /api/health/data), never hidden.

import { fetchPowerDaily, POWER_BASE_URL, POWER_COMMUNITY, POWER_PARAMETERS } from './power.js';
import { storeRun, storeMergedRun, recordFailedRun, withIngestionLock, ensureGridCell } from '../../data/climateStore.js';
import { powerCellFor } from '../../geo/climateGrid.js';

// If any variable is missing on more than this share of days we refuse the data.
export const MAX_MISSING_SHARE = 0.2;

function compactDate(value) {
  return value.replaceAll('-', '');
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return isoDate(result);
}

// One lock per district: a full ingest and an incremental refresh both replace the district's stored run,
// so they must never run at the same time (a range-specific key would let them overlap and lose data).
export function ingestionLockKey(district) {
  return `NASA POWER:${district.id}`;
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

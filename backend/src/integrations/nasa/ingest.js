// Ingests NASA POWER daily data for one district: fetch -> validate -> store with provenance.
// A failure is recorded as a FAILED run (visible at /api/health/data), never hidden.

import { fetchPowerDaily, POWER_BASE_URL, POWER_COMMUNITY, POWER_PARAMETERS } from './power.js';
import { storeRun, recordFailedRun } from '../../data/climateStore.js';

// If any variable is missing on more than this share of days we refuse the data.
export const MAX_MISSING_SHARE = 0.2;

export async function ingestDistrict({ prisma, district, startYear, endYear, fetchPower = fetchPowerDaily }) {
  const startDate = `${startYear}0101`;
  const endDate = `${endYear}1231`;
  const requestParams = {
    parameters: POWER_PARAMETERS,
    community: POWER_COMMUNITY,
    latitude: district.latitude,
    longitude: district.longitude,
    start: startDate,
    end: endDate,
    format: 'JSON',
  };
  const base = {
    source: 'NASA POWER',
    isSynthetic: false,
    endpointUrl: POWER_BASE_URL,
    requestParams,
    startDate: `${startYear}-01-01`,
    endDate: `${endYear}-12-31`,
  };

  try {
    const { parsed } = await fetchPower({ latitude: district.latitude, longitude: district.longitude, startDate, endDate });
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

    const run = await storeRun(prisma, {
      districtId: district.id,
      days: parsed.days,
      run: {
        ...base,
        product: parsed.product,
        fillValue: parsed.fillValue,
        units: parsed.units,
        missingCount,
        startDate: parsed.days[0].date,
        endDate: parsed.days[total - 1].date,
        notes,
      },
    });
    return { ok: true, runId: run.id, rows: total, missingCount, warnings: parsed.warnings };
  } catch (err) {
    await recordFailedRun(prisma, { districtId: district.id, run: base, errorMessage: err.message });
    return { ok: false, error: err.message };
  }
}

// Client and parser for the NASA POWER daily "point" API.
//
//   https://power.larc.nasa.gov/api/temporal/daily/point
//
// Facts taken from NASA's POWER documentation: daily data from 1981 to near real time, at most 20
// parameters per request, meteorology provided at roughly 0.5 degree source resolution,
// community "AG" is the agronomy community, and missing values are marked with a fill value
// (-999). The response shape below (properties.parameter.<NAME>.<YYYYMMDD>, header.fill_value,
// parameters.<NAME>.units) is what the parser expects. The parser reads the fill value and the
// units from NASA's own response instead of trusting our assumptions, and it refuses a
// response it does not recognise rather than guessing.
//
// IMPORTANT: this code was written without network access to NASA. It has been tested only
// against a hand-built fixture that mimics the documented shape (tests/power.test.js).
// The first live run (`npm run ingest:nasa`) is the real test: if it fails, paste the
// error. Nothing here pretends otherwise.

export const POWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
export const POWER_COMMUNITY = 'AG';
export const POWER_PARAMETERS = ['PRECTOTCORR', 'T2M_MAX', 'T2M_MIN'];
export const DEFAULT_FILL_VALUE = -999;

export class PowerError extends Error {
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = 'PowerError';
    this.status = status;
    this.retryable = retryable;
  }
}

export function buildPowerUrl({ latitude, longitude, startDate, endDate }) {
  const q = new URLSearchParams({
    parameters: POWER_PARAMETERS.join(','),
    community: POWER_COMMUNITY,
    longitude: String(longitude),
    latitude: String(latitude),
    start: startDate,
    end: endDate,
    format: 'JSON',
  });
  // URLSearchParams encodes the commas; POWER accepts both "," and "%2C".
  return `${POWER_BASE_URL}?${q.toString()}`;
}

function isoFromCompact(s) {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function unitLooksRight(parameter, units) {
  if (typeof units !== 'string') return true; // not reported: handled as a warning
  const u = units.toLowerCase().replace(/\s/g, '');
  if (parameter === 'PRECTOTCORR') return u.startsWith('mm');
  return u === 'c' || u === '°c' || u === 'degc' || u === 'degreec' || u === 'celsius';
}

// Plausibility limits. Values outside them are turned into "missing" and counted, never kept.
const LIMITS = {
  PRECTOTCORR: [0, 1000],
  T2M_MAX: [-20, 60],
  T2M_MIN: [-30, 40],
};

export function parsePowerResponse(json, { startDate, endDate } = {}) {
  const parameter = json?.properties?.parameter;
  if (!parameter || typeof parameter !== 'object') {
    throw new PowerError('Unexpected NASA POWER response: "properties.parameter" is missing.');
  }
  for (const name of POWER_PARAMETERS) {
    if (!parameter[name] || typeof parameter[name] !== 'object') {
      throw new PowerError(`Unexpected NASA POWER response: parameter ${name} is missing.`);
    }
  }

  const warnings = [];
  let fillValue = json?.header?.fill_value;
  if (typeof fillValue !== 'number') {
    fillValue = DEFAULT_FILL_VALUE;
    warnings.push(`header.fill_value not reported; assumed ${DEFAULT_FILL_VALUE} as documented.`);
  }

  const units = {};
  for (const name of POWER_PARAMETERS) {
    const u = json?.parameters?.[name]?.units;
    if (u === undefined) {
      warnings.push(`Units for ${name} not reported in the response.`);
      units[name] = null;
    } else if (!unitLooksRight(name, u)) {
      throw new PowerError(`Unexpected units for ${name}: "${u}". Refusing to ingest.`);
    } else {
      units[name] = u;
    }
  }

  const dates = Object.keys(parameter.PRECTOTCORR).filter((k) => /^\d{8}$/.test(k)).sort();
  if (dates.length === 0) throw new PowerError('NASA POWER response contained no daily values.');

  const missing = { precipMm: 0, tMaxC: 0, tMinC: 0 };
  let outOfRange = 0;
  let maxBelowMin = 0;

  const clean = (name, raw) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === fillValue) return null;
    const [lo, hi] = LIMITS[name];
    if (raw < lo || raw > hi) {
      outOfRange += 1;
      return null;
    }
    return raw;
  };

  const days = dates.map((d) => {
    const precipMm = clean('PRECTOTCORR', parameter.PRECTOTCORR[d]);
    const tMaxC = clean('T2M_MAX', parameter.T2M_MAX[d]);
    const tMinC = clean('T2M_MIN', parameter.T2M_MIN[d]);
    if (precipMm === null) missing.precipMm += 1;
    if (tMaxC === null) missing.tMaxC += 1;
    if (tMinC === null) missing.tMinC += 1;
    if (tMaxC !== null && tMinC !== null && tMaxC < tMinC) maxBelowMin += 1;
    return { date: isoFromCompact(d), precipMm, tMaxC, tMinC };
  });

  if (startDate && endDate) {
    const expected = Math.round((Date.UTC(+endDate.slice(0, 4), +endDate.slice(4, 6) - 1, +endDate.slice(6, 8)) -
      Date.UTC(+startDate.slice(0, 4), +startDate.slice(4, 6) - 1, +startDate.slice(6, 8))) / 86400000) + 1;
    if (days.length < expected) warnings.push(`Received ${days.length} days but ${expected} were requested.`);
  }
  if (outOfRange > 0) warnings.push(`${outOfRange} value(s) outside plausible limits were treated as missing.`);
  if (maxBelowMin > 0) warnings.push(`${maxBelowMin} day(s) had a daily maximum below the daily minimum (kept as reported).`);

  const header = json?.header ?? {};
  return {
    days,
    fillValue,
    units,
    missing,
    warnings,
    product: header.title ?? null,
    sources: header.sources ?? null,
    apiVersion: header.api?.version ?? null,
    timeStandard: header.time_standard ?? null,
  };
}

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch with timeout and retries (network errors, 429, 5xx). 4xx other than 429 are not retried.
export async function fetchPowerDaily(
  { latitude, longitude, startDate, endDate },
  { fetchImpl = fetch, retries = 3, timeoutMs = 120000, sleep = sleepDefault } = {},
) {
  const url = buildPowerUrl({ latitude, longitude, startDate, endDate });
  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 300);
        throw new PowerError(`NASA POWER answered HTTP ${res.status}. ${body}`, {
          status: res.status,
          retryable: res.status === 429 || res.status >= 500,
        });
      }
      const json = await res.json();
      return { url, parsed: parsePowerResponse(json, { startDate, endDate }) };
    } catch (err) {
      lastError = err;
      const retryable = err instanceof PowerError ? err.retryable : true; // network/timeout errors retry
      if (!retryable || attempt > retries) break;
      await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

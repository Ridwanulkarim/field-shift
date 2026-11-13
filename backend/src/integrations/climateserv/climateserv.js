// Client and strict parsers for NASA SERVIR ClimateSERV, used here ONLY to fetch daily CHIRPS rainfall so it can be
// compared with the NASA POWER rainfall the planting advisory is built on.
//
//   Service:  ClimateSERV (NASA / USAID SERVIR). It does not hold data of its own for this: it serves CHIRPS, a rainfall
//             product made by the UC Santa Barbara Climate Hazards Center with USGS. Credit CHIRPS as the data source and
//             ClimateSERV as the access route.
//   Dataset:  "Global CHIRPS", datatype 0, daily, 1981 to present (ClimateSERV API documentation).
//   Request:  asynchronous. submitDataRequest -> job id; getDataRequestProgress (0..100, -1 on error); getDataFromRequest.
//   Area:     the statistic (operationtype 5 = average) is taken over a GeoJSON polygon in EPSG:4326, so one value per day
//             describes the AVERAGE over that polygon, not a point and not a farm.
//
// STATUS: written from the public ClimateSERV API documentation (https://climateserv.readthedocs.io/en/latest/api.html).
// It has NOT been run against the live service. The documentation does not state authentication, rate limits, request size
// limits, the date format of each result row, the rainfall unit or the missing-data value. So every parser here is strict:
// anything that does not look as expected is REFUSED with an error that names what was wrong, instead of being guessed.
// Run `npm run fetch:chirps -- --district=rajshahi --from=2020-01-01 --to=2020-01-31` first and read the output.

export const CLIMATESERV_BASE = 'https://climateserv.servirglobal.net/chirps';
export const CHIRPS = Object.freeze({
  datatype: 0, // "Global CHIRPS" daily
  intervaltype: 0, // daily
  operationtype: 5, // average over the polygon
  operationName: 'avg',
  unit: 'mm/day (assumed from the CHIRPS product; ClimateSERV documentation does not state it: the probe prints a sample to confirm)',
  creditEn: 'CHIRPS rainfall (UC Santa Barbara Climate Hazards Center / USGS) accessed through NASA SERVIR ClimateSERV',
});
// CHIRPS marks missing cells with a large negative number (-9999). Anything below zero is treated as missing.
export const MAX_MM_PER_DAY = 1500; // above this a value is implausible and becomes missing
export const MAX_DAYS_PER_REQUEST = 366; // one calendar year per request keeps jobs small

export class ClimateServError extends Error {
  constructor(message, { retryable = false, fatal = false } = {}) {
    super(message);
    this.name = 'ClimateServError';
    this.retryable = retryable;
    this.fatal = fatal;
  }
}

const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const mdY = (iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const addDaysIso = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ---- request building ---------------------------------------------------------------------------

// A closed rectangle ring as GeoJSON ([lon, lat], counter-clockwise, first point repeated at the end).
export function polygonFromBounds({ minLon, maxLon, minLat, maxLat }) {
  const nums = [minLon, maxLon, minLat, maxLat];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) throw new ClimateServError('Bounds must be four finite numbers.', { fatal: true });
  if (!(minLon < maxLon) || !(minLat < maxLat)) throw new ClimateServError('Bounds must have min < max for both longitude and latitude.', { fatal: true });
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) throw new ClimateServError('Bounds are outside -180..180 / -90..90 (EPSG:4326).', { fatal: true });
  return { type: 'Polygon', coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
}

export function buildSubmitUrl({ startDate, endDate, polygon, base = CLIMATESERV_BASE }) {
  if (!isoOk(startDate) || !isoOk(endDate)) throw new ClimateServError('startDate and endDate must be real dates written YYYY-MM-DD.', { fatal: true });
  if (startDate > endDate) throw new ClimateServError('startDate must not be after endDate.', { fatal: true });
  const days = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1;
  if (days > MAX_DAYS_PER_REQUEST) throw new ClimateServError(`One request may cover at most ${MAX_DAYS_PER_REQUEST} days (asked for ${days}). Split the range.`, { fatal: true });
  if (!polygon || polygon.type !== 'Polygon') throw new ClimateServError('polygon must be a GeoJSON Polygon.', { fatal: true });
  const q = new URLSearchParams({
    datatype: String(CHIRPS.datatype),
    begintime: mdY(startDate),
    endtime: mdY(endDate),
    intervaltype: String(CHIRPS.intervaltype),
    operationtype: String(CHIRPS.operationtype),
    geometry: JSON.stringify(polygon),
  });
  return `${base}/submitDataRequest/?${q}`;
}

export const buildProgressUrl = (id, base = CLIMATESERV_BASE) => `${base}/getDataRequestProgress/?${new URLSearchParams({ id })}`;
export const buildDataUrl = (id, base = CLIMATESERV_BASE) => `${base}/getDataFromRequest/?${new URLSearchParams({ id })}`;

// ---- response parsing (strict) ------------------------------------------------------------------

const JOB_ID = /^[0-9a-fA-F-]{8,64}$/;

// The documentation says submitDataRequest returns a job id (a UUID). It may arrive as ["uuid"] or as "uuid".
export function parseJobId(json) {
  const raw = Array.isArray(json) ? json[0] : json;
  if (typeof raw !== 'string' || !JOB_ID.test(raw)) {
    throw new ClimateServError(`submitDataRequest did not return a job id (got ${JSON.stringify(json)?.slice(0, 120)}).`, { fatal: true });
  }
  return raw;
}

// Progress is a number 0..100, or -1 when the job failed. It may arrive as 12.5 or as [12.5].
export function parseProgress(json) {
  const raw = Array.isArray(json) ? json[0] : json;
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ClimateServError(`getDataRequestProgress returned something that is not a number (${JSON.stringify(json)?.slice(0, 120)}).`);
  if (value === -1) throw new ClimateServError('ClimateSERV reported that the job failed (progress -1).');
  if (value < 0 || value > 100) throw new ClimateServError(`Progress ${value} is outside 0..100.`);
  return value;
}

// One result row's calendar date. Accepts MM/DD/YYYY, YYYY-MM-DD or an epoch time (seconds or milliseconds, read as UTC).
export function parseRowDate(entry) {
  const d = entry?.date;
  if (typeof d === 'string') {
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim());
    if (us) {
      const iso = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
      if (isoOk(iso)) return iso;
    }
    if (isoOk(d.trim())) return d.trim();
  }
  const e = entry?.epochTime;
  if (typeof e === 'number' && Number.isFinite(e)) {
    const ms = e > 1e11 ? e : e * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  throw new ClimateServError(`A result row has no readable date (date=${JSON.stringify(d)}, epochTime=${JSON.stringify(e)}).`);
}

// getDataFromRequest -> [{ date: 'YYYY-MM-DD', precipMm: number | null }], one per calendar day of the request, in order.
// Refuses the response unless every requested day is present exactly once (a gap would silently become "no rain").
export function parseDailyRainfall(json, { startDate, endDate }) {
  const data = json?.data;
  if (!Array.isArray(data) || data.length === 0) throw new ClimateServError('getDataFromRequest returned no "data" array.');
  const byDate = new Map();
  for (const entry of data) {
    const date = parseRowDate(entry);
    const cell = entry?.value;
    const raw = cell && typeof cell === 'object' ? cell[CHIRPS.operationName] : undefined;
    if (raw !== null && typeof raw !== 'number') {
      throw new ClimateServError(`Row ${date}: expected a number under value.${CHIRPS.operationName}, got ${JSON.stringify(cell)?.slice(0, 80)}.`);
    }
    if (byDate.has(date)) throw new ClimateServError(`Row ${date} appears more than once.`);
    // Missing, fill (negative) and implausible values all become null: never a zero.
    byDate.set(date, raw === null || !Number.isFinite(raw) || raw < 0 || raw > MAX_MM_PER_DAY ? null : raw);
  }
  const rows = [];
  for (let date = startDate; date <= endDate; date = addDaysIso(date, 1)) {
    if (!byDate.has(date)) throw new ClimateServError(`The response has no row for ${date}; refusing a series with a gap.`);
    rows.push({ date, precipMm: byDate.get(date) });
  }
  if (byDate.size !== rows.length) throw new ClimateServError(`The response has ${byDate.size - rows.length} row(s) outside ${startDate}..${endDate}.`);
  return rows;
}

// ---- fetching -----------------------------------------------------------------------------------

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, fetchImpl, { retries = 3, sleep = defaultSleep, signalMs = 60000 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(signalMs) });
      if (res.status >= 500 || res.status === 429) throw new ClimateServError(`ClimateSERV answered HTTP ${res.status}.`, { retryable: true });
      if (!res.ok) throw new ClimateServError(`ClimateSERV answered HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`, { fatal: true });
      return await res.json();
    } catch (error) {
      last = error;
      const retryable = error instanceof ClimateServError ? error.retryable : true; // network errors and timeouts
      if (!retryable || attempt === retries) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw last instanceof ClimateServError ? last : new ClimateServError(`Could not reach ClimateSERV: ${last?.message ?? last}`, { retryable: true });
}

// One request of up to MAX_DAYS_PER_REQUEST days. Returns { rows, jobId }.
export async function fetchRainfallChunk({ startDate, endDate, polygon, fetchImpl = fetch, sleep = defaultSleep, pollMs = 3000, maxPolls = 200, base = CLIMATESERV_BASE }) {
  const jobId = parseJobId(await getJson(buildSubmitUrl({ startDate, endDate, polygon, base }), fetchImpl, { sleep }));
  for (let poll = 0; ; poll += 1) {
    if (poll >= maxPolls) throw new ClimateServError(`Job ${jobId} did not finish after ${maxPolls} checks.`);
    const progress = parseProgress(await getJson(buildProgressUrl(jobId, base), fetchImpl, { sleep }));
    if (progress >= 100) break;
    await sleep(pollMs);
  }
  const rows = parseDailyRainfall(await getJson(buildDataUrl(jobId, base), fetchImpl, { sleep }), { startDate, endDate });
  return { rows, jobId };
}

// Splits [startDate, endDate] into calendar-year chunks.
export function yearChunks(startDate, endDate) {
  if (!isoOk(startDate) || !isoOk(endDate) || startDate > endDate) throw new ClimateServError('Invalid date range.', { fatal: true });
  const chunks = [];
  for (let y = Number(startDate.slice(0, 4)); y <= Number(endDate.slice(0, 4)); y += 1) {
    const from = y === Number(startDate.slice(0, 4)) ? startDate : `${y}-01-01`;
    const to = y === Number(endDate.slice(0, 4)) ? endDate : `${y}-12-31`;
    chunks.push({ year: y, startDate: from, endDate: to });
  }
  return chunks;
}

// The whole range, one year per request, sequentially. onProgress({ year, done, total }) is called after each year.
export async function fetchDailyRainfall({ startDate, endDate, polygon, onProgress = () => {}, ...options }) {
  const chunks = yearChunks(startDate, endDate);
  const rows = [];
  const jobs = [];
  for (const [i, chunk] of chunks.entries()) {
    const result = await fetchRainfallChunk({ ...chunk, polygon, ...options });
    rows.push(...result.rows);
    jobs.push({ year: chunk.year, jobId: result.jobId });
    onProgress({ year: chunk.year, done: i + 1, total: chunks.length });
  }
  return { rows, jobs };
}

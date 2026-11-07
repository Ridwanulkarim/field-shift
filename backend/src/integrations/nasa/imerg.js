// Client and parsers for NASA GPM IMERG daily precipitation (Final Run, collection version 07), served by GES DISC.
//
//   Product:  GPM_3IMERGDF, collection version "07", global, 0.1 x 0.1 degree, daily mean precipitation rate in mm/day.
//   Variables read: `precipitation` (combined microwave-IR estimate; fill value -9999.9) and `precipitation_cnt` (the
//             count of valid half-hourly samples behind that day's value; an Int8 variable). Quality information is kept
//             next to the value, never discarded.
//   Versions: the COLLECTION version is "07". The file / algorithm release letter in each file name (for example
//             "V07B" in 3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4) is a different thing and is recorded
//             separately, per day.
//   Latency:  the Final Run is delayed by up to about 4 months, so recent months have no granule yet.
//   Coverage: NOT hard-coded. The first and last available day are read from NASA CMR (see getImergCoverage); sources
//             disagree on the start (a university mirror lists 2000-06-01, NASA material mentions 1998), so CMR decides.
//   Access:   1) NASA CMR (public, no login) lists the daily granules and their OPeNDAP links;
//             2) the OPeNDAP service (needs a free Earthdata token, sent as a Bearer header) returns a small DAP4
//                subset of the file, as CSV, for just the pixels we ask for.
//
// VERIFIED (probe run 2026-11-06, `npm run probe:imerg`, 2020-07-01, Rajshahi): the CMR search; the DAP4 ".dmr" and
// ".dap.csv" requests for the variable `precipitation`; units mm/day; _FillValue -9999.900391; dimensions [time][lon][lat];
// DAP2 is refused (Int8 variables), so DAP4 is required.
// NOT YET VERIFIED until the updated probe is run: the two-variable request (`precipitation` and `precipitation_cnt`
// in one constraint, separated by ";") and the exact CSV layout of the second variable. The parser is strict: if a
// requested variable is absent or has the wrong shape the response is refused instead of guessed.
// The token is only ever sent to NASA and never appears in an error message.

import { IMERG_GRID, IMERG_PROVIDER } from '../../geo/imergGrid.js';

export const IMERG_SOURCE = IMERG_PROVIDER; // 'NASA GPM IMERG'
export const IMERG_CMR_URL = 'https://cmr.earthdata.nasa.gov/search/granules.json';
export const IMERG_COLLECTION = Object.freeze({
  shortName: IMERG_GRID.product,
  collectionVersion: IMERG_GRID.version, // "07"
  versionNote: 'collectionVersion is the GES DISC collection (GPM_3IMERGDF.07). The V07A/V07B letter in each file name is the IMERG algorithm release of that file and is stored per day as fileVersion.',
});
export const IMERG_FILL_VALUE = -9999.9;
export const IMERG_VARIABLES = Object.freeze(['precipitation', 'precipitation_cnt']);
// Plausibility limits. Values outside become "missing", never kept.
export const IMERG_MAX_MM_PER_DAY = 1500;
export const IMERG_MAX_HALFHOUR_COUNT = 48; // a day has 48 half-hours

export class ImergError extends Error {
  // `fatal` means retrying cannot help (bad token, refused request) and the whole ingestion should stop.
  constructor(message, { status = null, retryable = false, fatal = false } = {}) {
    super(message);
    this.name = 'ImergError';
    this.status = status;
    this.retryable = retryable;
    this.fatal = fatal;
  }
}

const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

// ---- CMR granule listing ----------------------------------------------------------------------

export function buildGranuleSearchUrl({ startDate, endDate, pageNum = 1, pageSize = 2000, sortKey = 'start_date' }) {
  if (!isoOk(startDate) || !isoOk(endDate)) throw new ImergError('startDate and endDate must be YYYY-MM-DD.', { fatal: true });
  if (startDate > endDate) throw new ImergError('startDate must not be after endDate.', { fatal: true });
  const q = `short_name=${IMERG_GRID.product}&version=${IMERG_GRID.version}`
    + `&temporal=${startDate}T00:00:00Z,${endDate}T23:59:59Z&page_size=${pageSize}&page_num=${pageNum}&sort_key=${sortKey}`;
  return `${IMERG_CMR_URL}?${q}`;
}

// Date and file version from a granule title such as
// "GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.20200701-S000000-E235959.V07B.nc4".
export function parseGranuleTitle(title) {
  const m = /IMERG\.(\d{4})(\d{2})(\d{2})-S\d{6}-E\d{6}\.(V\d{2}[A-Z]?)\.nc4/.exec(title ?? '');
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  return isoOk(date) ? { date, fileVersion: m[4] } : null;
}

// Reads a CMR granules.json response into [{ date, fileVersion, title, opendapUrl }]. A granule without a recognisable
// date or OPeNDAP link is skipped and counted, not guessed.
export function parseGranuleSearch(json) {
  const entries = json?.feed?.entry;
  if (!Array.isArray(entries)) throw new ImergError('Unexpected CMR response: no feed.entry list.', { fatal: true });
  const granules = [];
  let skipped = 0;
  for (const entry of entries) {
    const parsed = parseGranuleTitle(entry?.title);
    const opendapUrl = (entry?.links ?? []).map((l) => l?.href).find((h) => typeof h === 'string' && h.includes('opendap.earthdata.nasa.gov'));
    if (!parsed || !opendapUrl) {
      skipped += 1;
      continue;
    }
    granules.push({ date: parsed.date, fileVersion: parsed.fileVersion, title: entry.title, opendapUrl });
  }
  return { granules, skipped, pageCount: entries.length };
}

async function cmrGet(url, { fetchImpl, timeoutMs }) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new ImergError(`CMR granule search failed: ${err.message}`, { retryable: true });
  }
  if (!res.ok) throw new ImergError(`CMR granule search returned HTTP ${res.status}.`, { status: res.status, retryable: res.status >= 500 || res.status === 429 });
  return res.json();
}

// All daily granules between two dates, oldest first. Pages through CMR until a short page is returned.
export async function listImergGranules({ startDate, endDate }, { fetchImpl = fetch, timeoutMs = 60_000, pageSize = 2000 } = {}) {
  const all = [];
  let skipped = 0;
  for (let pageNum = 1; pageNum <= 50; pageNum += 1) {
    const page = parseGranuleSearch(await cmrGet(buildGranuleSearchUrl({ startDate, endDate, pageNum, pageSize }), { fetchImpl, timeoutMs }));
    all.push(...page.granules);
    skipped += page.skipped;
    if (page.pageCount < pageSize) break;
  }
  const byDate = new Map(all.map((g) => [g.date, g]));
  return { granules: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), skipped };
}

// What NASA CMR actually has: the first and last available daily granule of the collection, with their file versions.
// Nothing about the coverage is hard-coded; callers use this instead of a fixed start date.
export async function getImergCoverage({ fetchImpl = fetch, timeoutMs = 60_000, today = new Date().toISOString().slice(0, 10) } = {}) {
  const one = async (sortKey) => {
    const url = buildGranuleSearchUrl({ startDate: '1990-01-01', endDate: today, pageSize: 1, sortKey });
    const { granules } = parseGranuleSearch(await cmrGet(url, { fetchImpl, timeoutMs }));
    return granules[0] ?? null;
  };
  const [first, last] = await Promise.all([one('start_date'), one('-start_date')]);
  if (!first || !last) throw new ImergError('CMR returned no granules for the collection.');
  return { firstDate: first.date, firstFileVersion: first.fileVersion, lastDate: last.date, lastFileVersion: last.fileVersion };
}

// ---- OPeNDAP subset ---------------------------------------------------------------------------

// DAP4 constraint for one day and both variables: /precipitation[time][lon range][lat range];/precipitation_cnt[...],
// inclusive index ranges, in the dimension order [time][lon][lat] reported by the service. Brackets must be
// percent-encoded or the server rejects the URL.
export function buildSubsetUrl(opendapUrl, block, variables = IMERG_VARIABLES) {
  if (typeof opendapUrl !== 'string' || !opendapUrl.startsWith('https://opendap.earthdata.nasa.gov/')) {
    throw new ImergError('Refusing to send a request to a host other than opendap.earthdata.nasa.gov.', { fatal: true });
  }
  const base = opendapUrl.replace(/\.(html|dds|dmr|das|ascii|dap(\.csv|\.nc4)?)$/, '');
  const slice = `[0][${block.cols.first}:${block.cols.last}][${block.rows.first}:${block.rows.last}]`;
  const ce = variables.map((v) => `/${v}${slice}`).join(';');
  return `${base}.dap.csv?dap4.ce=${encodeURIComponent(ce)}`;
}

// Parses the DAP4 CSV into { <variable>: values[lonOffset][latOffset] } for every requested variable. Layout (REAL sample
// for `precipitation`, see tests/helpers/imergSample.js; the second variable is assumed to use the same layout):
//   Dataset: <file name>
//   /precipitation[0][0], 0, 0, 0.165, 1.305, 1.97      <- one line per longitude, one value per latitude
// The shape must match the requested block exactly for every variable, otherwise the response is refused.
export function parseSubsetCsv(text, block, variables = IMERG_VARIABLES) {
  if (typeof text !== 'string') throw new ImergError('Empty IMERG response.');
  const wantLon = block.cols.count;
  const wantLat = block.rows.count;
  const out = Object.fromEntries(variables.map((v) => [v, []]));
  for (const line of text.split(/\r?\n/)) {
    const m = /^\/(\w+)\[(\d+)\]\[(\d+)\],\s*(.+)$/.exec(line.trim());
    if (!m || !(m[1] in out)) continue;
    const rows = out[m[1]];
    if (Number(m[2]) !== 0) throw new ImergError(`Unexpected time index ${m[2]} in the IMERG response.`);
    if (Number(m[3]) !== rows.length) throw new ImergError('IMERG response rows are not in longitude order.');
    const row = m[4].split(',').map((s) => Number(s.trim()));
    if (row.length !== wantLat) throw new ImergError(`IMERG response row has ${row.length} values, expected ${wantLat}.`);
    rows.push(row);
  }
  for (const v of variables) {
    if (out[v].length !== wantLon) throw new ImergError(`IMERG response has ${out[v].length} longitude rows for ${v}, expected ${wantLon}.`);
  }
  return out;
}

// One native pixel-day from the parsed subset. precipMm is null when the value is the fill value, not a number, or
// implausible; zero rain is a real value (0 mm). The valid half-hourly count is kept as given (integer 0..48) or null.
export function pixelDaysFromSubset(parsed, block, { fileVersion = null } = {}) {
  const out = [];
  for (let c = 0; c < block.cols.count; c += 1) {
    for (let r = 0; r < block.rows.count; r += 1) {
      const p = parsed.precipitation[c][r];
      const n = parsed.precipitation_cnt?.[c]?.[r];
      const precipOk = Number.isFinite(p) && Math.abs(p - IMERG_FILL_VALUE) > 1 && p >= 0 && p <= IMERG_MAX_MM_PER_DAY;
      const cntOk = Number.isInteger(n) && n >= 0 && n <= IMERG_MAX_HALFHOUR_COUNT;
      out.push({
        row: block.rows.first + r,
        col: block.cols.first + c,
        precipMm: precipOk ? Math.round(p * 1000) / 1000 : null,
        precipitationCnt: cntOk ? n : null,
        fileVersion,
      });
    }
  }
  return out;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One day for one pixel block. Retries network errors, HTTP 429 and 5xx with a short growing pause. 401/403 mean the
// token is missing, expired or not authorised for GES DISC: that is fatal and says so without echoing the token.
export async function fetchImergDay({ granule, block, token }, { fetchImpl = fetch, timeoutMs = 60_000, retries = 3, sleep = defaultSleep } = {}) {
  if (!token) throw new ImergError('EARTHDATA_TOKEN is not set.', { fatal: true });
  const url = buildSubsetUrl(granule.opendapUrl, block);
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 401 || res.status === 403) {
        throw new ImergError(`Earthdata rejected the token (HTTP ${res.status}). Check that it is valid and that "NASA GESDISC DATA ARCHIVE" is authorised for your account.`, { status: res.status, fatal: true });
      }
      if (res.status === 429 || res.status >= 500) throw new ImergError(`IMERG service returned HTTP ${res.status}.`, { status: res.status, retryable: true });
      if (!res.ok) throw new ImergError(`IMERG service returned HTTP ${res.status} for ${granule.date}.`, { status: res.status });
      return { pixels: pixelDaysFromSubset(parseSubsetCsv(await res.text(), block), block, { fileVersion: granule.fileVersion ?? null }) };
    } catch (err) {
      lastError = err instanceof ImergError ? err : new ImergError(`Request failed for ${granule.date}: ${err.message}`, { retryable: true });
      if (!lastError.retryable || attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

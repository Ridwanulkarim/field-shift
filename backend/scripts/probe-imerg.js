// Smallest possible check that GPM IMERG daily data can be reached, BEFORE (and whenever) the ingestion is run.
// It makes a few small requests for ONE day and ONE POWER cell and prints what NASA actually returns so the real response
// format can be confirmed. It stores nothing and changes nothing.
//
//   npm run probe:imerg                                      (defaults: 2020-07-01, Rajshahi)
//   npm run probe:imerg -- --date=2021-08-15 --lat=23.6 --lon=89.84
//
// Needs a free NASA Earthdata account and a token in EARTHDATA_TOKEN (see .env.example) for steps C and D. The token is
// sent only to NASA hosts and is never printed. Do not commit it.
//
// Step 0: what NASA CMR says the collection covers (first and last available day, with file versions). No login.
// Step A: CMR granule search for the chosen day. No login. Finds the real file and its file version.
// Step C: OPeNDAP DAP4 metadata (.dmr): units, fill value and attributes of `precipitation` and `precipitation_cnt`.
// Step D: a tiny DAP4 subset (.dap.csv) of BOTH variables for the pixels inside the POWER cell, parsed with the same
//         code the ingestion uses. This is what proves the quality count can be stored.

import { parseArgs } from 'node:util';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { imergPixelsInCell } from '../src/geo/imergGrid.js';
import { buildGranuleSearchUrl, getImergCoverage, parseGranuleSearch, parseSubsetCsv, pixelDaysFromSubset, buildSubsetUrl, IMERG_COLLECTION } from '../src/integrations/nasa/imerg.js';

const { values } = parseArgs({ options: { date: { type: 'string' }, lat: { type: 'string' }, lon: { type: 'string' } } });
const date = values.date ?? '2020-07-01';
const lat = Number(values.lat ?? 24.37);
const lon = Number(values.lon ?? 88.6);
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
  console.error('--date must be a real calendar date, YYYY-MM-DD.');
  process.exit(1);
}
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error('--lat and --lon must be numbers.');
  process.exit(1);
}

const token = process.env.EARTHDATA_TOKEN;
const cell = powerCellFor(lat, lon);
const block = imergPixelsInCell(cell);
console.log(`Point ${lat}, ${lon} -> POWER cell ${cell.cellKey}, ${block.pixelCount} IMERG pixels (${block.rows.count} rows x ${block.cols.count} columns)`);
console.log(`Collection ${IMERG_COLLECTION.shortName}, collection version ${IMERG_COLLECTION.collectionVersion}`);
console.log(`Token present: ${token ? 'yes' : 'NO (steps C and D need it)'}\n`);

const show = (text, n = 1800) => console.log(String(text).slice(0, n));

async function get(url, { auth = false } = {}) {
  const headers = auth && token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    return { status: res.status, finalUrl: res.url, text: await res.text() };
  } catch (err) {
    return { status: 0, finalUrl: url, text: `request failed: ${err.message}` };
  }
}

// ---- Step 0 ----
console.log('STEP 0  CMR coverage of the collection');
try {
  const cov = await getImergCoverage();
  console.log(`first available day: ${cov.firstDate} (file version ${cov.firstFileVersion})`);
  console.log(`last available day:  ${cov.lastDate} (file version ${cov.lastFileVersion})`);
} catch (err) {
  console.log(`could not read the coverage: ${err.message}`);
}

// ---- Step A ----
console.log('\nSTEP A  CMR granule search');
const a = await get(buildGranuleSearchUrl({ startDate: date, endDate: date, pageSize: 1 }));
console.log(`status ${a.status}`);
let granule = null;
try {
  granule = parseGranuleSearch(JSON.parse(a.text)).granules[0] ?? null;
} catch {
  show(a.text);
}
if (!granule) {
  console.log('No granule found for that date. IMERG Final runs up to about 4 months behind, so recent dates have no file yet.');
  process.exit(1);
}
console.log(`granule: ${granule.title}`);
console.log(`file version (algorithm release, from the file name): ${granule.fileVersion}`);
console.log(`collection version: ${IMERG_COLLECTION.collectionVersion}`);
console.log(`OPeNDAP link: ${granule.opendapUrl}\n`);
if (!token) {
  console.log('Stopping here: set EARTHDATA_TOKEN to continue with steps C and D.');
  process.exit(0);
}
const base = granule.opendapUrl.replace(/\.(html|dds|dmr|das|ascii)$/, '');

// ---- Step C ----
console.log('STEP C  OPeNDAP DAP4 metadata (.dmr)');
const c = await get(`${base}.dmr`, { auth: true });
console.log(`status ${c.status}  final host: ${new URL(c.finalUrl).host}`);
for (const name of ['precipitation', 'precipitation_cnt']) {
  const m = new RegExp(`<(\\w+) name="${name}">[\\s\\S]*?</\\1>`).exec(c.text);
  console.log(`\n-- ${name} --`);
  console.log(m ? m[0] : '(not found in the metadata)');
}

// ---- Step D ----
console.log('\nSTEP D  subset of precipitation AND precipitation_cnt');
const url = buildSubsetUrl(granule.opendapUrl, block);
console.log(`constraint (decoded): ${decodeURIComponent(url.split('dap4.ce=')[1])}`);
const d = await get(url, { auth: true });
console.log(`status ${d.status}`);
show(d.text, 3000);
if (d.status === 200) {
  try {
    const parsed = parseSubsetCsv(d.text, block);
    const days = pixelDaysFromSubset(parsed, block, { fileVersion: granule.fileVersion });
    console.log(`\nParsed OK: ${days.length} pixel-days. First three:`);
    for (const px of days.slice(0, 3)) console.log(JSON.stringify(px));
    const withCount = days.filter((p) => p.precipitationCnt !== null).length;
    console.log(`pixel-days with a valid half-hourly count: ${withCount} of ${days.length}`);
  } catch (err) {
    console.log(`\nThe response could not be parsed: ${err.message}`);
  }
}
console.log('\nDone. Nothing was stored. Paste the output above (it contains no secrets).');

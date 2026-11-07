// Smallest possible check that GPM IMERG daily data can be reached, BEFORE any pipeline is built on it.
// It makes three small requests for ONE day and ONE POWER cell, and prints what NASA actually returns so that
// the real response format can be confirmed. It stores nothing and changes nothing.
//
//   npm run probe:imerg                                      (defaults: 2020-07-01, Rajshahi)
//   npm run probe:imerg -- --date=2021-08-15 --lat=23.6 --lon=89.84
//
// Needs a free NASA Earthdata account and a token in the environment variable EARTHDATA_TOKEN (see .env.example).
// The token is sent only to NASA hosts and is never printed. Do not commit it.
//
// Step A: NASA CMR granule search. Public, no login. Finds the real file for that day.
// Step B: OPeNDAP DAP4 metadata (.dmr) of that file, with the token. Shows the precipitation variable's units and fill value.
// Step C: a tiny DAP4 subset (.dap.csv) covering the IMERG pixels inside the POWER cell, with the token.

import { parseArgs } from 'node:util';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { imergPixelsInCell } from '../src/geo/imergGrid.js';

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
const pixels = imergPixelsInCell(cell);
console.log(`Point ${lat}, ${lon} -> POWER cell ${cell.cellKey}, ${pixels.pixelCount} IMERG pixels (${pixels.rows.count} rows x ${pixels.cols.count} columns)`);
console.log(`Token present: ${token ? 'yes' : 'NO (steps B and C need it)'}\n`);

const show = (text) => console.log(String(text).slice(0, 1500));

async function get(url, { auth = false } = {}) {
  const headers = auth && token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    return { status: res.status, finalUrl: res.url, text: await res.text() };
  } catch (err) {
    return { status: 0, finalUrl: url, text: `request failed: ${err.message}` };
  }
}

// ---- Step A ----
const start = `${date}T00:00:00Z`;
const end = `${date}T23:59:59Z`;
const cmr = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=GPM_3IMERGDF&version=07&temporal=${start},${end}&page_size=1`;
console.log('STEP A  CMR granule search');
const a = await get(cmr);
console.log(`status ${a.status}`);
let granule = null;
try {
  granule = JSON.parse(a.text).feed.entry[0] ?? null;
} catch {
  show(a.text);
}
if (!granule) {
  console.log('No granule found for that date. IMERG Final runs about 4 months behind, so recent dates have no file yet.');
  process.exit(1);
}
console.log(`granule: ${granule.title}`);
const links = (granule.links ?? []).map((l) => l.href).filter((h) => /\.nc4$/.test(h) || /opendap/i.test(h));
for (const h of links) console.log(`  link: ${h}`);

const dataUrl = links.find((h) => /\.nc4$/.test(h) && !/opendap/i.test(h));
const opendap = links.find((h) => /opendap/i.test(h))
  ?? (dataUrl ? dataUrl.replace(/^https:\/\/data\.gesdisc\.earthdata\.nasa\.gov\/data\//, 'https://gpm1.gesdisc.eosdis.nasa.gov/opendap/') : null);
if (!opendap) {
  console.log('Could not work out an OPeNDAP URL from the granule links.');
  process.exit(1);
}
const base = opendap.replace(/\.(html|dds|das|ascii)$/, '');
console.log(`OPeNDAP base (a guess if no opendap link was listed): ${base}\n`);
if (!token) {
  console.log('Stopping here: set EARTHDATA_TOKEN to continue with steps B and C.');
  process.exit(0);
}

// ---- Step B ----
// The service refuses the older DAP2 model for this file (it has Int8 variables), so DAP4 is used: ".dmr" is the
// DAP4 metadata. The dimension order was already confirmed by the service itself as [time][lon][lat].
console.log('STEP B  OPeNDAP DAP4 metadata (.dmr)');
const b = await get(`${base}.dmr`, { auth: true });
console.log(`status ${b.status}  final host: ${new URL(b.finalUrl).host}`);
const precipBlock = b.text.match(/<Float32 name="precipitation">[\s\S]*?<\/Float32>/);
show(precipBlock ? precipBlock[0] : b.text);

// ---- Step C ----
// DAP4 constraint: /precipitation[time][lon][lat] with inclusive index ranges. Brackets must be percent-encoded.
const ce = `/precipitation[0][${pixels.cols.first}:${pixels.cols.last}][${pixels.rows.first}:${pixels.rows.last}]`;
console.log(`\nSTEP C  subset: ${ce}`);
const c = await get(`${base}.dap.csv?dap4.ce=${encodeURIComponent(ce)}`, { auth: true });
console.log(`status ${c.status}`);
show(c.text);
console.log('\nDone. Nothing was stored. Paste the output above (it contains no secrets).');

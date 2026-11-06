// Probes the LIVE NASA POWER service to find where its grid-cell edges actually are, and compares them with the
// assumed grid (0.5 deg latitude x 0.625 deg longitude). It walks a line of points, 0.05 degrees apart, across
// two expected edges on each axis, asks POWER for five days of temperatures at every point, and notes where the
// returned values change: that is a cell edge. (POWER echoes the requested coordinates back, so they cannot be
// used to identify the cell; the data themselves are the evidence.)
// Needs internet access to power.larc.nasa.gov. Read-only: writes nothing to any database. Takes a few minutes.
//
// Usage: npm run check:power-grid
// Exit code 0 = every expected edge found within one step and no unexpected edge; 1 otherwise.

import { POWER_BASE_URL, POWER_COMMUNITY } from '../src/integrations/nasa/power.js';
import { expectedEdges } from '../src/geo/climateGrid.js';
import { detectEdges, matchEdges } from '../src/geo/gridProbe.js';

const STEP = 0.05;
const PAUSE_MS = 1500;
// Lines pass through the interior of the Rajshahi cell so that each axis crosses two expected edges.
const LINES = [
  { axis: 'lat', label: 'latitude', fixed: { lon: 88.75 }, from: 24.0, to: 25.0 },
  { axis: 'lon', label: 'longitude', fixed: { lat: 24.5 }, from: 88.3, to: 89.3 },
];

async function signatureAt(lat, lon) {
  const url = `${POWER_BASE_URL}?parameters=T2M_MAX,T2M_MIN&community=${POWER_COMMUNITY}&longitude=${lon}&latitude=${lat}&start=20240101&end=20240105&format=JSON`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for (${lat}, ${lon})`);
  const body = await res.json();
  const p = body?.properties?.parameter;
  if (!p?.T2M_MAX || !p?.T2M_MIN) throw new Error(`Unexpected response shape for (${lat}, ${lon})`);
  return JSON.stringify([p.T2M_MAX, p.T2M_MIN]);
}

let allOk = true;
for (const line of LINES) {
  const samples = [];
  const count = Math.round((line.to - line.from) / STEP);
  console.log(`\nProbing ${line.label} ${line.from} to ${line.to} (${count + 1} points)...`);
  for (let i = 0; i <= count; i += 1) {
    const pos = Math.round((line.from + i * STEP) * 1e6) / 1e6;
    const lat = line.axis === 'lat' ? pos : line.fixed.lat;
    const lon = line.axis === 'lon' ? pos : line.fixed.lon;
    try {
      samples.push({ pos, signature: await signatureAt(lat, lon) });
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  const detected = detectEdges(samples);
  const expected = expectedEdges(line.axis, line.from, line.to);
  const result = matchEdges(detected, expected, STEP);
  console.log(`  detected edges near: ${detected.map((e) => e.estimate.toFixed(3)).join(', ') || 'none'}`);
  console.log(`  expected edges at:   ${expected.join(', ') || 'none'}`);
  for (const m of result.matched) console.log(`  MATCH   expected ${m.expected}, found about ${m.detected.toFixed(3)} (offset ${m.offset.toFixed(3)})`);
  for (const e of result.missing) console.log(`  MISSING expected edge at ${e}: no change in the data there`);
  for (const e of result.unexpected) console.log(`  EXTRA   unexpected edge near ${e.toFixed(3)}`);
  if (detected.length >= 2) console.log(`  implied cell size from the first two edges: ${(detected[1].estimate - detected[0].estimate).toFixed(3)} degrees`);
  if (!result.ok) allOk = false;
}
console.log(allOk
  ? '\nRESULT: the live service changes values exactly where the assumed grid has cell edges. You may set POWER_GRID.verified = true in src/geo/climateGrid.js.'
  : '\nRESULT: the live edges do NOT match the assumed grid. Do not set POWER_GRID.verified = true. Send this output so the grid constants can be corrected.');
process.exit(allOk ? 0 : 1);

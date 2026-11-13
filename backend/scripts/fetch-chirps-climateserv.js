// Fetches DAILY CHIRPS rainfall for one district (or all) from NASA SERVIR ClimateSERV and saves it, with provenance,
// to data/chirps/<district>.json. The area is the same NASA POWER grid cell that the advisory already uses for that
// district, so the two sources describe the same ground.
//
//   First, a tiny probe (one month) to confirm the service answers the way the documentation says:
//     npm run fetch:chirps -- --district=rajshahi --from=2020-06-01 --to=2020-06-30 --out=/tmp/chirps-probe
//   Then the real thing (25 requests, one per year; it can take a while, and skips a district that already has a file):
//     npm run fetch:chirps -- --district=rajshahi
//     npm run fetch:chirps -- --district=all
//   --force re-downloads. Needs internet access. No key is documented for ClimateSERV; none is used here.
import { parseArgs } from 'node:util';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { CHIRPS, CLIMATESERV_BASE, fetchDailyRainfall, polygonFromBounds } from '../src/integrations/climateserv/climateserv.js';
import { buildChirpsFile, chirpsPath, writeChirpsFile, DEFAULT_CHIRPS_DIR } from '../src/data/chirpsStore.js';
import fs from 'node:fs';

const { values } = parseArgs({
  options: {
    district: { type: 'string', default: 'rajshahi' },
    from: { type: 'string', default: '2001-01-01' },
    to: { type: 'string', default: '2025-12-31' },
    out: { type: 'string', default: DEFAULT_CHIRPS_DIR },
    force: { type: 'boolean', default: false },
    base: { type: 'string', default: CLIMATESERV_BASE }, // only for rehearsing against a local test server
  },
});

if (values.base !== CLIMATESERV_BASE && values.out === DEFAULT_CHIRPS_DIR) {
  console.error('Refusing to write into data/chirps/ from a non-default --base: that folder is for real ClimateSERV data only. Pass --out=<another folder>.');
  process.exit(1);
}

const targets = values.district === 'all' ? DISTRICTS : DISTRICTS.filter((d) => d.slug === values.district);
if (targets.length === 0) {
  console.error(`Unknown district "${values.district}". Use one of: ${DISTRICTS.map((d) => d.slug).join(', ')}, or all.`);
  process.exit(1);
}

let failed = 0;
const byCell = new Map(); // districts that share a POWER cell share one download within a run
for (const district of targets) {
  const target = chirpsPath(district.slug, values.out);
  if (fs.existsSync(target) && !values.force) {
    console.log(`${district.slug}: ${target} already exists (use --force to download again).`);
    continue;
  }
  const cell = powerCellFor(district.latitude, district.longitude);
  const polygon = polygonFromBounds(cell.bounds);
  console.log(`${district.slug}: CHIRPS ${values.from}..${values.to} over the NASA POWER cell ${cell.cellKey} (${cell.bounds.minLat}..${cell.bounds.maxLat} N, ${cell.bounds.minLon}..${cell.bounds.maxLon} E)`);
  try {
    let downloaded = byCell.get(cell.cellKey);
    if (downloaded) {
      console.log(`  same cell as ${downloaded.firstDistrict}: reusing that download (no new requests)`);
    } else {
      downloaded = {
        firstDistrict: district.slug,
        ...(await fetchDailyRainfall({
          startDate: values.from,
          endDate: values.to,
          polygon,
          base: values.base,
          pollMs: values.base === CLIMATESERV_BASE ? 3000 : 5,
          onProgress: ({ year, done, total }) => console.log(`  ${year} done (${done}/${total})`),
        })),
      };
      byCell.set(cell.cellKey, downloaded);
    }
    const { rows, jobs } = downloaded;
    const missing = rows.filter((r) => r.precipMm === null).length;
    const provenance = {
      source: 'CHIRPS via NASA SERVIR ClimateSERV',
      credit: CHIRPS.creditEn,
      isSynthetic: false,
      dataStatus: 'cached',
      endpointBase: values.base,
      request: { datatype: CHIRPS.datatype, intervaltype: CHIRPS.intervaltype, operationtype: CHIRPS.operationtype, operation: CHIRPS.operationName },
      area: { description: `Average over the NASA POWER grid cell ${cell.cellKey} used for ${district.slug}`, bounds: cell.bounds, polygon },
      unit: CHIRPS.unit,
      requestedRange: { startDate: values.from, endDate: values.to },
      retrievedAt: new Date().toISOString(),
      jobs,
      rowCount: rows.length,
      missingDays: missing,
      notes: ['Area average, not a point or a farm.', 'Missing, negative or implausible values are stored as null, never as zero.'],
    };
    const written = writeChirpsFile(buildChirpsFile({ district, provenance, series: rows }), values.out);
    console.log(`  saved ${rows.length} days (${missing} missing) to ${written}`);
    console.log(`  sample: ${rows.slice(0, 3).map((r) => `${r.date}=${r.precipMm}`).join('  ')}  <- check these look like mm/day`);
  } catch (error) {
    failed += 1;
    console.error(`  FAILED: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);

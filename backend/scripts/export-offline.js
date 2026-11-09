// Exports the REAL stored NASA POWER series of your demo districts to committed JSON files, for the offline demo.
// Run once while the database is reachable, then commit backend/data/offline/. Read-only on the database.
//
//   npm run export:offline                                   every district that has real stored data
//   npm run export:offline -- --districts=rajshahi,bogura    only these (an error if one has no real data)
//   npm run export:offline -- --dir=/some/other/folder
//
// Synthetic demo data is never exported: a district whose newest run is synthetic is skipped (or an error with --districts).

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { buildOfflineFile, writeOfflineFiles, DEFAULT_OFFLINE_DIR } from '../src/data/offlineStore.js';

const { values } = parseArgs({ options: { districts: { type: 'string' }, dir: { type: 'string' } } });
const wanted = values.districts ? values.districts.split(',').map((s) => s.trim()).filter(Boolean) : null;
const dir = values.dir || config.offlineDataDir || DEFAULT_OFFLINE_DIR;

if (!config.databaseUrl) {
  console.error('No database URL is set for this NODE_ENV (see docs/SETUP.md). The exporter reads the stored series from the database.');
  process.exit(1);
}

const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);
let failed = false;
try {
  const districts = await repository.listDistricts();
  const known = new Set(districts.map((d) => d.slug));
  for (const slug of wanted ?? []) if (!known.has(slug)) { console.error(`Unknown district "${slug}".`); failed = true; }
  const targets = districts.filter((d) => (wanted ? wanted.includes(d.slug) : true));
  const files = [];
  for (const d of targets) {
    const climate = await repository.getClimate(d.id);
    if (!climate) {
      const msg = `${d.slug}: no stored climate data`;
      if (wanted) { console.error(`ERROR ${msg}`); failed = true; } else console.log(`skip  ${msg}`);
      continue;
    }
    try {
      files.push(buildOfflineFile({ district: d, climate }));
    } catch (err) {
      if (wanted) { console.error(`ERROR ${err.message}`); failed = true; } else console.log(`skip  ${d.slug}: ${err.message}`);
    }
  }
  if (failed || files.length === 0) {
    console.error(failed ? '\nNothing written because of the errors above.' : '\nNo real stored data to export. Run "npm run ingest:nasa" first.');
    process.exitCode = 1;
  } else {
    const manifest = writeOfflineFiles(dir, files);
    const pad = (v, n) => String(v ?? '-').padEnd(n);
    console.log(['district', 'rows', 'first', 'last', 'run', 'retrieved', 'missing precip'].map((h, i) => pad(h, [14, 6, 11, 11, 5, 11, 14][i])).join(' '));
    for (const f of files) {
      console.log([pad(f.district.slug, 14), pad(f.rows.length, 6), pad(f.rows[0][0], 11), pad(f.rows[f.rows.length - 1][0], 11), pad(f.provenance.runId, 5), pad(f.provenance.retrievedAt.slice(0, 10), 11), pad(f.provenance.missingCount, 14)].join(' '));
    }
    console.log(`\nWrote ${Object.keys(manifest.districts).length} file(s) + manifest.json to ${dir}`);
    console.log('Next: npm run check:offline, then commit backend/data/offline/ (real NASA POWER data; the files are small enough to commit).');
  }
} finally {
  await prisma.$disconnect();
}

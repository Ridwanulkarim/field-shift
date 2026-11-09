// Checks the committed offline files with NO database and NO network: every file is validated (format, clean daily dates,
// real NASA POWER only, sha256 intact) and the advisory is run from the files exactly as the offline API would.
//
//   npm run check:offline
//   npm run check:offline -- --crop=aman
//
// Exit code 1 if any file is invalid or none is found. Use it as the last step of the wifi-off rehearsal.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { loadOfflineStore, DEFAULT_OFFLINE_DIR } from '../src/data/offlineStore.js';
import { createOfflineRepository } from '../src/data/offlineRepository.js';
import { createEvaluationService } from '../src/services/evaluationService.js';

const { values } = parseArgs({ options: { crop: { type: 'string', default: 'aman' } } });
const store = loadOfflineStore(config.offlineDataDir || DEFAULT_OFFLINE_DIR);
const pad = (v, n) => String(v ?? '-').padEnd(n);

console.log(`Offline folder: ${store.dir}`);
for (const p of store.problems) console.log(`INVALID ${p.slug}.json: ${p.problems.join('; ')}`);
if (store.entries.size === 0) {
  console.error('No valid offline files. Run "npm run export:offline" while the database is reachable (docs/OFFLINE.md).');
  process.exit(1);
}

const service = createEvaluationService(createOfflineRepository(store));
console.log(['district', 'rows', 'first', 'last', 'retrieved', `advisory(${values.crop})`, 'shared grid cell with'].map((h, i) => pad(h, [14, 6, 11, 11, 11, 30, 22][i])).join(' '));
for (const [slug, f] of store.entries) {
  let verdict;
  try {
    const adv = await service.advisory(slug, { crop: values.crop, splitYear: null, lang: 'en', usual: null, includeHeat: false });
    verdict = `${adv.decision.kind} (p=${adv.evidence.strength?.pValue ?? '-'})`;
  } catch (err) {
    verdict = `error: ${err.code ?? err.message}`;
  }
  const shared = (await createOfflineRepository(store).getDistrictBySlug(slug)).sharedGridCellWith;
  console.log([pad(slug, 14), pad(f.rows.length, 6), pad(f.rows[0][0], 11), pad(f.rows[f.rows.length - 1][0], 11), pad(f.provenance.retrievedAt.slice(0, 10), 11), pad(verdict, 30), pad(shared.join(',') || '-', 22)].join(' '));
}
process.exitCode = store.problems.length ? 1 : 0;
if (store.problems.length) console.error('\nSome files are invalid and would NOT be served. Re-run "npm run export:offline".');

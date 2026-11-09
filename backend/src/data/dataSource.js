// Decides where the API reads climate from, once, at start-up. Kept out of server.js so it can be tested.
//
//   OFFLINE=1                       -> the committed offline files only. No database is opened, no network is used.
//   database configured             -> the database; if the offline files exist, reads fall back to them when it fails.
//   nothing configured, files exist -> the offline files (so `npm start` still works on a laptop with no database).
//   nothing configured, no files    -> no repository: data routes answer 503 (as before).

import { loadOfflineStore } from './offlineStore.js';
import { createOfflineRepository, createResilientRepository } from './offlineRepository.js';

export async function createDataSource(config, { createDatabaseRepository, loadStore = loadOfflineStore } = {}) {
  const store = loadStore(config.offlineDataDir || undefined);
  const notes = [];
  for (const p of store.problems) notes.push(`WARNING: offline file "${p.slug}.json" is NOT served: ${p.problems.join('; ')}`);
  const offline = createOfflineRepository(store);
  const hasFiles = store.entries.size > 0;

  if (config.offline) {
    if (!hasFiles) {
      throw new Error(`OFFLINE=1 but no valid offline climate files were found in ${store.dir}. Run "npm run export:offline" once while the database is reachable, commit the files, then retry. See docs/OFFLINE.md.`);
    }
    notes.push(`OFFLINE=1: serving ${store.entries.size} district(s) from ${store.dir}. The database and the network are not used.`);
    return { repository: offline, mode: offline.mode, close: async () => {}, notes };
  }

  if (config.databaseUrl) {
    const { repository: db, close } = await createDatabaseRepository(config.databaseUrl);
    if (hasFiles) {
      notes.push(`Offline fallback ready: ${store.entries.size} district(s) in ${store.dir} will be used if the database cannot be reached.`);
      return { repository: createResilientRepository(db, offline), mode: 'database-with-offline-fallback', close, notes };
    }
    notes.push('No offline climate files found: if the database is unreachable, data routes will fail. Run "npm run export:offline" and commit the result (docs/OFFLINE.md).');
    return { repository: db, mode: 'database', close, notes };
  }

  if (hasFiles) {
    notes.push(`No database URL is set, so the API serves ${store.entries.size} district(s) from the offline files in ${store.dir}.`);
    return { repository: offline, mode: offline.mode, close: async () => {}, notes };
  }
  notes.push('WARNING: No database URL is set for the selected NODE_ENV and there are no offline files. The API will start, but data routes will answer 503. See docs/SETUP.md and docs/OFFLINE.md.');
  return { repository: undefined, mode: 'none', close: async () => {}, notes };
}

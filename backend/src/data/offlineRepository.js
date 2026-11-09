// A file-based repository with the same READ interface the evaluation service uses (listDistricts, getDistrictBySlug,
// listCrops, getClimate, recentFailedRuns, ping), plus a wrapper that falls back to it when the database is down.
//
// It serves only what `npm run export:offline` wrote from real stored NASA POWER runs. It has no field, boundary or
// session methods: those need PostGIS, so in offline mode the field endpoints answer 503 and everything else works.
//
// Offline district ids are NEGATIVE (-1, -2, ...). Database ids are positive. The two can therefore never be confused
// when a request starts on the database and finishes on the files (see createResilientRepository).

import { DISTRICTS } from './reference/districts.js';
import { CROPS } from './reference/crops.js';
import { rowsToSeries } from './offlineStore.js';

const OFFLINE_ID = (index) => -(index + 1);

export const OFFLINE_NOTE =
  'Served from a committed offline file (a snapshot of real NASA POWER data exported from the database), not from a live query. The retrieval time and run id are those of the original NASA POWER download.';

function publicDistrict(d, index) {
  return {
    id: OFFLINE_ID(index),
    slug: d.slug,
    nameEn: d.nameEn,
    nameBn: d.nameBn,
    division: d.division,
    latitude: d.latitude,
    longitude: d.longitude,
    coordNote: d.coordNote,
  };
}

// store: the result of loadOfflineStore(). districts / crops default to the reference tables the database is seeded from.
export function createOfflineRepository(store, { districts = DISTRICTS, crops = CROPS } = {}) {
  const list = districts.map(publicDistrict);
  const bySlug = new Map(list.map((d) => [d.slug, d]));
  const byId = new Map(list.map((d) => [d.id, d]));
  const seriesCache = new Map();

  // Districts whose stored series are byte-identical were served by one NASA grid cell: the same rule the database uses.
  const sharing = new Map();
  for (const [slug, file] of store.entries) {
    const same = [...store.entries].filter(([other, f]) => other !== slug && f.seriesSha256 === file.seriesSha256).map(([other]) => other).sort();
    sharing.set(slug, same);
  }

  function climateFor(slug) {
    const file = store.entries.get(slug);
    if (!file) return null;
    let series = seriesCache.get(slug);
    if (!series) {
      series = rowsToSeries(file.rows);
      seriesCache.set(slug, series);
    }
    return {
      provenance: { ...file.provenance, dataStatus: 'cached', servedFrom: 'offline-file', offlineExportedAt: file.exportedAt, offlineNote: OFFLINE_NOTE },
      series,
    };
  }

  return {
    mode: 'offline-files',
    offlineSlugs: () => [...store.entries.keys()],
    offlineProblems: () => store.problems,

    async ping() {
      return store.entries.size > 0;
    },

    async listDistricts() {
      return list.map((d) => {
        const file = store.entries.get(d.slug);
        return {
          ...d,
          climateData: file ? 'nasa' : 'none',
          dataStatus: file ? 'cached' : 'unavailable',
          latestObservationDate: file ? file.provenance.endDate : null,
          lastRetrievedAt: file ? file.provenance.retrievedAt : null,
          rowCount: file ? file.rows.length : 0,
          missingCount: file ? file.provenance.missingCount ?? 0 : 0,
          sharedGridCellWith: sharing.get(d.slug) ?? [],
          servedFrom: file ? 'offline-file' : null,
        };
      });
    },

    async getDistrictBySlug(slug) {
      const d = bySlug.get(slug);
      return d ? { ...d, sharedGridCellWith: sharing.get(slug) ?? [] } : null;
    },

    async listCrops() {
      return crops.map((c, i) => ({ id: i + 1, ...c }));
    },

    async getClimate(districtId) {
      const d = byId.get(districtId);
      return d ? climateFor(d.slug) : null;
    },

    getClimateBySlug: async (slug) => climateFor(slug),

    async recentFailedRuns() {
      return [];
    },
  };
}

// Wraps the database repository. Reads go to the database; when a read FAILS (not when it returns nothing) the same read is
// answered from the offline files, and for `cooldownMs` afterwards every read goes straight to the files so one request
// never mixes two sources. After the cooldown the database is tried again. A read that fails on both throws the
// database's error. Methods the files cannot answer (fields, boundaries, IMERG) always go to the database.
//
// This is not silent: every fallback is logged, `isDegraded()` is exposed for /api/health, and every response served from a
// file carries provenance.servedFrom = 'offline-file'.
export function createResilientRepository(primary, offline, { cooldownMs = 30_000, now = () => Date.now(), log = console.warn } = {}) {
  let degradedUntil = 0;
  let lastError = null;
  const idToSlug = new Map(); // positive database id -> slug, remembered so a request that straddles the switch still resolves
  const isDegraded = () => now() < degradedUntil;

  function degrade(err, what) {
    lastError = { message: err?.message ?? String(err), at: new Date(now()).toISOString(), during: what };
    const first = !isDegraded();
    degradedUntil = now() + cooldownMs;
    if (first) log(`WARNING: database read "${what}" failed (${lastError.message}). Serving climate from the offline files for ${Math.round(cooldownMs / 1000)} s, then retrying the database.`);
  }

  async function read(what, fromPrimary, fromOffline) {
    if (isDegraded()) return fromOffline();
    try {
      return await fromPrimary();
    } catch (err) {
      if (err?.name === 'HttpError') throw err; // a deliberate API error is not a database outage
      degrade(err, what);
      try {
        return await fromOffline();
      } catch {
        throw err;
      }
    }
  }

  const remember = (d) => {
    if (d && d.id > 0) idToSlug.set(d.id, d.slug);
    return d;
  };

  return {
    ...primary,
    mode: 'database-with-offline-fallback',
    isDegraded,
    lastFallbackError: () => lastError,
    offlineSlugs: offline.offlineSlugs,

    pingDatabase: () => primary.ping(), // the real database, never answered from files (used by /api/health/db)
    ping: () => read('ping', () => primary.ping(), () => offline.ping()),

    listDistricts: () =>
      read('listDistricts', async () => {
        const rows = await primary.listDistricts();
        rows.forEach(remember);
        return rows;
      }, () => offline.listDistricts()),

    getDistrictBySlug: (slug) => read('getDistrictBySlug', async () => remember(await primary.getDistrictBySlug(slug)), () => offline.getDistrictBySlug(slug)),

    listCrops: () => read('listCrops', () => primary.listCrops(), () => offline.listCrops()),

    getClimate: (districtId, opts) =>
      read('getClimate', () => primary.getClimate(districtId, opts), async () => {
        const slug = districtId > 0 ? idToSlug.get(districtId) : null;
        return slug ? offline.getClimateBySlug(slug) : offline.getClimate(districtId);
      }),

    recentFailedRuns: (limit) => read('recentFailedRuns', () => primary.recentFailedRuns(limit), () => offline.recentFailedRuns()),
  };
}

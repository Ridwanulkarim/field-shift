// Offline path: file store validation, the file-based repository, the database-with-fallback wrapper, start-up
// selection (OFFLINE=1), and the API answering from files.
//
// ALL CLIMATE DATA HERE ARE HAND-BUILT TEST FIXTURES written to a temporary folder. The provenance says "NASA POWER" only
// because the loader refuses any other label; none of these numbers is a NASA observation, and nothing here is ever written
// to backend/data/offline/.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { CROPS } from '../src/data/reference/crops.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { buildSeries } from './helpers/series.js';
import { createEvaluationService } from '../src/services/evaluationService.js';
import { buildOfflineFile, writeOfflineFiles, loadOfflineStore, validateOfflineFile, OFFLINE_FORMAT } from '../src/data/offlineStore.js';
import { createOfflineRepository, createResilientRepository } from '../src/data/offlineRepository.js';
import { createDataSource } from '../src/data/dataSource.js';
import { notFound } from '../src/utils/errors.js';

const shifted = () => buildSeries(2001, 2025, (y, m, d) => {
  const startDay = y < 2013 ? 10 + (y % 4) : 27 + (y % 4);
  const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
  return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
});
const other = () => buildSeries(2001, 2025, (y, m, d) => ({ precipMm: m === 7 ? 12 : 0.5 + (d % 3), tMaxC: 31, tMinC: 21 }));

const provenance = (over = {}) => ({
  runId: 7, source: 'NASA POWER', product: 'TEST FIXTURE', isSynthetic: false, dataStatus: 'cached',
  retrievedAt: '2026-11-02T16:55:22.041Z', startDate: '2001-01-01', endDate: '2025-12-31', endpointUrl: 'https://example.invalid/test',
  requestParams: {}, fillValue: -999, units: { precipMm: 'mm/day' }, rowCount: 9131, missingCount: 0, notes: null, resolutionNote: 'test', ...over,
});
const district = (slug) => ({ ...DISTRICTS.find((d) => d.slug === slug) });

function exportFile(slug, series = shifted(), prov = provenance()) {
  return buildOfflineFile({ district: district(slug), climate: { provenance: prov, series }, exportedAt: '2026-11-08T10:00:00.000Z' });
}

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-offline-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('buildOfflineFile / validateOfflineFile', () => {
  it('refuses synthetic data and any source other than NASA POWER', () => {
    expect(() => exportFile('rajshahi', shifted(), provenance({ isSynthetic: true, source: 'SYNTHETIC' }))).toThrow(/SYNTHETIC/);
    expect(() => exportFile('rajshahi', shifted(), provenance({ source: 'NASA GPM IMERG' }))).toThrow(/expected "NASA POWER"/);
  });

  it('produces a file that validates and keeps every provenance field', () => {
    const f = exportFile('rajshahi');
    expect(f.format).toBe(OFFLINE_FORMAT);
    expect(validateOfflineFile(f, 'rajshahi').ok).toBe(true);
    expect(f.provenance).toMatchObject({ runId: 7, source: 'NASA POWER', retrievedAt: '2026-11-02T16:55:22.041Z', fillValue: -999 });
    expect(f.rows).toHaveLength(shifted().length);
  });

  it('detects a hand-edited value, a changed provenance field and a wrong file name', () => {
    const edited = exportFile('rajshahi');
    edited.rows[100][1] = 99.9;
    const r1 = validateOfflineFile(edited, 'rajshahi');
    expect(r1.ok).toBe(false);
    expect(r1.problems.join(' ')).toMatch(/sha256 does not match/);

    const relabelled = exportFile('rajshahi');
    relabelled.provenance.retrievedAt = '2030-01-01T00:00:00.000Z';
    expect(validateOfflineFile(relabelled, 'rajshahi').ok).toBe(false);

    expect(validateOfflineFile(exportFile('rajshahi'), 'dhaka').problems.join(' ')).toMatch(/does not match the file name/);
  });

  it('rejects synthetic provenance, unsorted or duplicate dates, malformed rows and an empty series, even with a valid hash', () => {
    const bad = (mutate) => {
      const f = exportFile('rajshahi');
      mutate(f);
      return validateOfflineFile(f, 'rajshahi');
    };
    expect(bad((f) => { f.provenance.isSynthetic = true; }).problems.join(' ')).toMatch(/isSynthetic/);
    expect(bad((f) => { f.rows[5][0] = f.rows[4][0]; }).problems.join(' ')).toMatch(/strictly ascending/);
    expect(bad((f) => { f.rows[3] = ['2001-01-04', 'x', 1, 1]; }).problems.join(' ')).toMatch(/malformed/);
    expect(bad((f) => { f.rows = []; }).problems.join(' ')).toMatch(/empty/);
    expect(bad((f) => { f.format = 'nope'; }).problems.join(' ')).toMatch(/unknown format/);
    expect(validateOfflineFile(null, 'x').ok).toBe(false);
  });

  it('keeps missing values as null and never turns them into zero', () => {
    const series = shifted();
    series[10].precipMm = null;
    const f = exportFile('rajshahi', series);
    expect(f.rows[10][1]).toBeNull();
    writeOfflineFiles(dir, [f]);
    const store = loadOfflineStore(dir);
    const repo = createOfflineRepository(store);
    return repo.getDistrictBySlug('rajshahi').then(async (d) => {
      const climate = await repo.getClimate(d.id);
      expect(climate.series[10].precipMm).toBeNull();
    });
  });
});

describe('writeOfflineFiles / loadOfflineStore', () => {
  it('round-trips files, writes a manifest, and reports invalid files without serving them', () => {
    writeOfflineFiles(dir, [exportFile('rajshahi'), exportFile('dhaka', other())]);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).districts.rajshahi.rows).toBe(shifted().length);
    fs.writeFileSync(path.join(dir, 'bogura.json'), '{ not json');
    const tampered = JSON.parse(fs.readFileSync(path.join(dir, 'dhaka.json'), 'utf8'));
    tampered.rows[0][1] = 5;
    fs.writeFileSync(path.join(dir, 'dhaka.json'), JSON.stringify(tampered));
    const store = loadOfflineStore(dir);
    expect([...store.entries.keys()]).toEqual(['rajshahi']);
    expect(store.problems.map((p) => p.slug).sort()).toEqual(['bogura', 'dhaka']);
  });

  it('treats a missing folder as "no files", not as an error', () => {
    const store = loadOfflineStore(path.join(dir, 'does-not-exist'));
    expect(store.entries.size).toBe(0);
    expect(store.problems).toEqual([]);
  });
});

describe('createOfflineRepository', () => {
  it('lists every reference district, marks only the exported ones as having data, and uses negative ids', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const repo = createOfflineRepository(loadOfflineStore(dir));
    const list = await repo.listDistricts();
    expect(list).toHaveLength(DISTRICTS.length);
    const raj = list.find((d) => d.slug === 'rajshahi');
    expect(raj).toMatchObject({ climateData: 'nasa', dataStatus: 'cached', servedFrom: 'offline-file', latestObservationDate: '2025-12-31' });
    expect(raj.id).toBeLessThan(0);
    expect(list.find((d) => d.slug === 'dhaka')).toMatchObject({ climateData: 'none', dataStatus: 'unavailable', rowCount: 0 });
    expect(await repo.getClimate(list.find((d) => d.slug === 'dhaka').id)).toBeNull();
    expect(await repo.getDistrictBySlug('atlantis')).toBeNull();
  });

  it('flags districts whose stored series are identical as sharing one grid cell (like Jashore and Khulna)', async () => {
    writeOfflineFiles(dir, [exportFile('jashore'), exportFile('khulna'), exportFile('dhaka', other())]);
    const repo = createOfflineRepository(loadOfflineStore(dir));
    expect((await repo.getDistrictBySlug('jashore')).sharedGridCellWith).toEqual(['khulna']);
    expect((await repo.getDistrictBySlug('khulna')).sharedGridCellWith).toEqual(['jashore']);
    expect((await repo.getDistrictBySlug('dhaka')).sharedGridCellWith).toEqual([]);
  });

  it('labels the climate it serves as an offline snapshot with the ORIGINAL retrieval time', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const repo = createOfflineRepository(loadOfflineStore(dir));
    const d = await repo.getDistrictBySlug('rajshahi');
    const { provenance: p } = await repo.getClimate(d.id);
    expect(p).toMatchObject({ servedFrom: 'offline-file', dataStatus: 'cached', isSynthetic: false, retrievedAt: '2026-11-02T16:55:22.041Z', offlineExportedAt: '2026-11-08T10:00:00.000Z' });
    expect(p.offlineNote).toMatch(/not from a live query/);
  });

  it('gives the same advisory from the files as from the same series in memory (the JSON round trip changes nothing)', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const fileService = createEvaluationService(createOfflineRepository(loadOfflineStore(dir)));
    const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
    const memoryService = createEvaluationService({
      listDistricts: async () => districts,
      getDistrictBySlug: async (s) => districts.find((d) => d.slug === s) ?? null,
      listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
      getClimate: async () => ({ provenance: provenance(), series: shifted().map((r) => ({ ...r, measurements: null })) }),
    });
    const input = { crop: 'aman', splitYear: null, lang: 'en', usual: null, includeHeat: false };
    const a = await fileService.advisory('rajshahi', input);
    const b = await memoryService.advisory('rajshahi', input);
    expect(a.decision).toEqual(b.decision);
    expect(a.evidence.distributions).toEqual(b.evidence.distributions);
    expect(a.evidence.strength).toEqual(b.evidence.strength);
    expect(a.sentence.sms).toEqual(b.sentence.sms);
    expect(a.provenance.servedFrom).toBe('offline-file');
    expect(b.provenance.servedFrom).toBe('database');
  });
});

describe('API with the offline repository only (OFFLINE=1)', () => {
  const makeApp = () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const repository = createOfflineRepository(loadOfflineStore(dir));
    return createApp(loadConfig({}), { repository });
  };

  it('serves districts, crops and the advisory with servedFrom = offline-file', async () => {
    const app = makeApp();
    expect((await request(app).get('/api/districts')).body.districts.find((d) => d.slug === 'rajshahi').climateData).toBe('nasa');
    expect((await request(app).get('/api/crops')).body.crops.length).toBe(CROPS.length);
    const res = await request(app).get('/api/districts/rajshahi/advisory?crop=aman');
    expect(res.status).toBe(200);
    expect(res.body.provenance.servedFrom).toBe('offline-file');
    expect(res.body.dataLabel).toMatchObject({ kind: 'nasa_stored', servedFrom: 'offline-file', isSynthetic: false });
    expect(res.body.sentence.sms.en.length).toBeLessThanOrEqual(160);
  });

  it('answers 404 NO_REAL_CLIMATE_DATA (not a fake result) for a district that was not exported', async () => {
    const res = await request(makeApp()).get('/api/districts/dhaka/advisory?crop=aman');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_REAL_CLIMATE_DATA');
  });

  it('evaluates rotations for a district without needing the database', async () => {
    const res = await request(makeApp()).post('/api/evaluate').send({ district: 'rajshahi', existingRotation: ['boro', 'aman'] });
    expect(res.status).toBe(200);
    expect(res.body.climate.provenance.servedFrom).toBe('offline-file');
    expect(res.body.strategies.length).toBeGreaterThan(1);
  });

  it('answers 503 on the field endpoints (they need PostGIS) and says why', async () => {
    const res = await request(makeApp()).get('/api/fields');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/OFFLINE=1|database/);
  });

  it('reports the mode in /api/health and refuses to call the database reachable', async () => {
    const app = makeApp();
    const health = await request(app).get('/api/health');
    expect(health.body).toMatchObject({ status: 'ok', dataMode: 'offline-files', degraded: false });
    const db = await request(app).get('/api/health/db');
    expect(db.status).toBe(503);
    expect(db.body.error.code).toBe('OFFLINE_MODE');
    const data = await request(app).get('/api/health/data');
    expect(data.status).toBe(200);
    expect(data.body.dataMode).toBe('offline-files');
    expect(data.body.tally.nasa).toBe(1);
  });

  it('accepts a same-origin POST (single-server demo) but still rejects a foreign origin', async () => {
    const app = makeApp();
    const body = { district: 'rajshahi', existingRotation: ['boro', 'aman'] };
    const same = await request(app).post('/api/evaluate').set('Host', 'localhost:4000').set('Origin', 'http://localhost:4000').send(body);
    expect(same.status).toBe(200);
    const foreign = await request(app).post('/api/evaluate').set('Host', 'localhost:4000').set('Origin', 'http://evil.example').send(body);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });
});

describe('createResilientRepository', () => {
  const setup = () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const offline = createOfflineRepository(loadOfflineStore(dir));
    let clock = 1_000_000;
    let dbUp = true;
    const calls = { getClimate: 0 };
    const dbDistricts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
    const primary = {
      ping: async () => { if (!dbUp) throw new Error('connect ECONNREFUSED'); return true; },
      listDistricts: async () => { if (!dbUp) throw new Error('connect ECONNREFUSED'); return dbDistricts; },
      getDistrictBySlug: async (s) => { if (!dbUp) throw new Error('connect ECONNREFUSED'); return dbDistricts.find((d) => d.slug === s) ?? null; },
      listCrops: async () => { if (!dbUp) throw new Error('connect ECONNREFUSED'); return CROPS.map((c, i) => ({ id: i + 1, ...c })); },
      getClimate: async (id) => {
        calls.getClimate += 1;
        if (!dbUp) throw new Error('connect ECONNREFUSED');
        return id === 1 ? { provenance: provenance({ runId: 50 }), series: shifted() } : null;
      },
      recentFailedRuns: async () => [],
      createField: async () => ({}), // a database-only method
    };
    const logs = [];
    const repo = createResilientRepository(primary, offline, { cooldownMs: 30_000, now: () => clock, log: (m) => logs.push(m) });
    return { repo, offline, logs, calls, setDb: (v) => { dbUp = v; }, advance: (ms) => { clock += ms; } };
  };

  it('uses the database while it works and never touches the files', async () => {
    const { repo, logs } = setup();
    const d = await repo.getDistrictBySlug('rajshahi');
    const c = await repo.getClimate(d.id);
    expect(c.provenance.runId).toBe(50);
    expect(c.provenance.servedFrom).toBeUndefined();
    expect(repo.isDegraded()).toBe(false);
    expect(logs).toEqual([]);
  });

  it('falls back to the files when a database read fails, logs it once, and flags degraded', async () => {
    const { repo, logs, setDb } = setup();
    setDb(false);
    const d = await repo.getDistrictBySlug('rajshahi');
    expect(d.id).toBeLessThan(0);
    const c = await repo.getClimate(d.id);
    expect(c.provenance.servedFrom).toBe('offline-file');
    expect(repo.isDegraded()).toBe(true);
    expect(repo.lastFallbackError().message).toMatch(/ECONNREFUSED/);
    expect(logs).toHaveLength(1);
    await repo.listCrops();
    expect(logs).toHaveLength(1); // not one warning per request
  });

  it('keeps using the files during the cooldown, then retries the database and recovers', async () => {
    const { repo, calls, setDb, advance } = setup();
    setDb(false);
    await repo.getDistrictBySlug('rajshahi');
    setDb(true);
    const before = calls.getClimate;
    advance(10_000);
    const stillOffline = await repo.getDistrictBySlug('rajshahi');
    expect(stillOffline.id).toBeLessThan(0);
    expect(calls.getClimate).toBe(before);
    advance(30_000);
    const back = await repo.getDistrictBySlug('rajshahi');
    expect(back.id).toBe(1);
    expect(repo.isDegraded()).toBe(false);
  });

  it('resolves a database id to the right file when the outage starts between two reads of one request', async () => {
    const { repo, setDb } = setup();
    const d = await repo.getDistrictBySlug('rajshahi'); // database id 1, remembered
    setDb(false); // the database dies before getClimate
    const c = await repo.getClimate(d.id);
    expect(c.provenance.servedFrom).toBe('offline-file');
    expect(c.series.length).toBe(shifted().length);
  });

  it('does not fall back when the database answers "nothing" (that is data, not an outage)', async () => {
    const { repo } = setup();
    const dhaka = await repo.getDistrictBySlug('dhaka');
    expect(await repo.getClimate(dhaka.id)).toBeNull();
    expect(repo.isDegraded()).toBe(false);
  });

  it('does not treat a deliberate API error as an outage', async () => {
    const { offline, advance } = setup();
    advance(0);
    const primary = { getDistrictBySlug: async () => { throw notFound('X', 'nope'); }, ping: async () => true };
    const repo = createResilientRepository(primary, offline, { log: () => {} });
    await expect(repo.getDistrictBySlug('x')).rejects.toMatchObject({ code: 'X' });
    expect(repo.isDegraded()).toBe(false);
  });

  it('throws the database error when the files cannot answer either', async () => {
    const { setDb } = setup();
    const offline = createOfflineRepository({ dir, entries: new Map(), problems: [] });
    const primary = { listCrops: async () => { throw new Error('db down'); } };
    const repo = createResilientRepository(primary, { ...offline, listCrops: async () => { throw new Error('files down'); } }, { log: () => {} });
    setDb(false);
    await expect(repo.listCrops()).rejects.toThrow('db down');
  });

  it('still exposes database-only methods unchanged', () => {
    const { repo } = setup();
    expect(typeof repo.createField).toBe('function');
  });
});

describe('createDataSource (start-up selection)', () => {
  const cfg = (over) => ({ offline: false, offlineDataDir: dir, databaseUrl: '', ...over });
  const dbFactory = () => {
    const state = { created: 0 };
    return {
      state,
      createDatabaseRepository: async () => {
        state.created += 1;
        return { repository: { ping: async () => true, createField: async () => ({}) }, close: async () => {} };
      },
    };
  };

  it('OFFLINE=1 with files: uses only the files and never opens the database', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const { state, createDatabaseRepository } = dbFactory();
    const src = await createDataSource(cfg({ offline: true, databaseUrl: 'postgresql://x' }), { createDatabaseRepository });
    expect(src.mode).toBe('offline-files');
    expect(state.created).toBe(0);
    expect(src.notes.join(' ')).toMatch(/OFFLINE=1/);
  });

  it('OFFLINE=1 with no valid files: fails fast with the fix, instead of starting a demo with no data', async () => {
    await expect(createDataSource(cfg({ offline: true }), { createDatabaseRepository: dbFactory().createDatabaseRepository })).rejects.toThrow(/export:offline/);
  });

  it('database plus files: database with an offline fallback', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    const { state, createDatabaseRepository } = dbFactory();
    const src = await createDataSource(cfg({ databaseUrl: 'postgresql://x' }), { createDatabaseRepository });
    expect(src.mode).toBe('database-with-offline-fallback');
    expect(state.created).toBe(1);
  });

  it('database but no files: plain database, with a note about the missing fallback', async () => {
    const src = await createDataSource(cfg({ databaseUrl: 'postgresql://x' }), { createDatabaseRepository: dbFactory().createDatabaseRepository });
    expect(src.mode).toBe('database');
    expect(src.notes.join(' ')).toMatch(/No offline climate files/);
  });

  it('no database but files: serves the files; nothing at all: no repository (routes answer 503)', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi')]);
    expect((await createDataSource(cfg(), { createDatabaseRepository: dbFactory().createDatabaseRepository })).mode).toBe('offline-files');
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-empty-'));
    const none = await createDataSource(cfg({ offlineDataDir: empty }), { createDatabaseRepository: dbFactory().createDatabaseRepository });
    expect(none.repository).toBeUndefined();
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('warns about an invalid file by name and does not serve it', async () => {
    writeOfflineFiles(dir, [exportFile('rajshahi'), exportFile('dhaka', other())]);
    const t = JSON.parse(fs.readFileSync(path.join(dir, 'dhaka.json'), 'utf8'));
    t.rows[0][2] = 1;
    fs.writeFileSync(path.join(dir, 'dhaka.json'), JSON.stringify(t));
    const src = await createDataSource(cfg({ offline: true }), { createDatabaseRepository: dbFactory().createDatabaseRepository });
    expect(src.notes.join('\n')).toMatch(/dhaka\.json" is NOT served/);
    expect(src.repository.offlineSlugs()).toEqual(['rajshahi']);
  });
});

describe('OFFLINE configuration flag', () => {
  it('parses 1/true/on as true and 0/false/unset as false, and rejects nonsense', () => {
    expect(loadConfig({}).offline).toBe(false);
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) expect(loadConfig({ OFFLINE: v }).offline).toBe(true);
    for (const v of ['0', 'false', 'no', 'off', '']) expect(loadConfig({ OFFLINE: v }).offline).toBe(false);
    expect(() => loadConfig({ OFFLINE: 'maybe' })).toThrow(/OFFLINE/);
  });
});

describe('the committed demo folder', () => {
  it('only ever contains valid, real-labelled files (an empty folder is fine until the exporter has run)', () => {
    const store = loadOfflineStore();
    expect(store.problems).toEqual([]);
    for (const f of store.entries.values()) {
      expect(f.provenance.isSynthetic).toBe(false);
      expect(f.provenance.source).toBe('NASA POWER');
    }
  });
});

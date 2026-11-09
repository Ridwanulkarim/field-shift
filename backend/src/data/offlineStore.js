// Reading, writing and validating the committed offline climate files (one JSON file per district).
// No database, no network, no Express: just files. See docs/OFFLINE.md.
//
// WHAT A FILE HOLDS: the daily NASA POWER series of ONE district exactly as the database stored it, plus the full
// provenance of the run it came from (source, product, run id, retrieval time, request parameters, units ...). The files
// are written by `npm run export:offline` from REAL stored runs only. Synthetic runs are refused on write and on read, so
// a demo fixture can never be committed or served as a NASA observation.
//
// INTEGRITY: every file carries a sha256 of its provenance + rows. A file that was edited by hand, truncated, or
// whose rows are not a clean daily series fails validation and is NOT served (the reason is reported, not hidden).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const OFFLINE_FORMAT = 'field-shift-offline-climate/1';
export const COLUMNS = ['date', 'precipMm', 'tMaxC', 'tMinC'];
export const DEFAULT_OFFLINE_DIR = fileURLToPath(new URL('../../data/offline/', import.meta.url));

const SLUG = /^[a-z0-9-]{2,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

export function seriesToRows(series) {
  return series.map((r) => [r.date, r.precipMm ?? null, r.tMaxC ?? null, r.tMinC ?? null]);
}

export function rowsToSeries(rows) {
  return rows.map(([date, precipMm, tMaxC, tMinC]) => ({ date, precipMm, tMaxC, tMinC, measurements: null }));
}

// Hash of the rows alone: two districts served from the same NASA grid cell have the same value (used to say so in the UI).
export const rowsSha256 = (rows) => sha256(JSON.stringify(rows));
const fileSha256 = (provenance, rows) => sha256(JSON.stringify({ provenance, rows }));

// Build the object to write from what the repository returns for a district ({ provenance, series }).
export function buildOfflineFile({ district, climate, exportedAt = new Date().toISOString() }) {
  const { provenance, series } = climate;
  if (provenance.isSynthetic) throw new Error(`Refusing to export ${district.slug}: its newest run is SYNTHETIC demo data, not a NASA observation.`);
  if (provenance.source !== 'NASA POWER') throw new Error(`Refusing to export ${district.slug}: source is "${provenance.source}", expected "NASA POWER".`);
  if (series.some((r) => r.measurements !== null && r.measurements !== undefined)) {
    throw new Error(`Refusing to export ${district.slug}: rows carry extra measurements that this format does not store.`);
  }
  const rows = seriesToRows(series);
  const { servedFrom, offlineExportedAt, ...cleanProvenance } = provenance; // never re-export an offline marker
  return {
    format: OFFLINE_FORMAT,
    exportedAt,
    district: { slug: district.slug, nameEn: district.nameEn, latitude: district.latitude, longitude: district.longitude },
    provenance: cleanProvenance,
    columns: COLUMNS,
    rows,
    sha256: fileSha256(cleanProvenance, rows),
    seriesSha256: rowsSha256(rows),
  };
}

export function writeOfflineFiles(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { format: OFFLINE_FORMAT, exportedAt: new Date().toISOString(), districts: {} };
  for (const f of files) {
    fs.writeFileSync(path.join(dir, `${f.district.slug}.json`), `${JSON.stringify(f)}\n`);
    manifest.districts[f.district.slug] = {
      rows: f.rows.length,
      first: f.rows[0]?.[0] ?? null,
      last: f.rows[f.rows.length - 1]?.[0] ?? null,
      runId: f.provenance.runId,
      retrievedAt: f.provenance.retrievedAt,
      sha256: f.sha256,
    };
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

// Returns { ok: true, file } or { ok: false, problems: [...] }. Never throws on bad content.
export function validateOfflineFile(file, expectedSlug) {
  const problems = [];
  if (!file || typeof file !== 'object') return { ok: false, problems: ['not a JSON object'] };
  if (file.format !== OFFLINE_FORMAT) problems.push(`unknown format "${file.format}" (expected ${OFFLINE_FORMAT})`);
  if (!SLUG.test(file.district?.slug ?? '')) problems.push('district.slug is missing or invalid');
  else if (expectedSlug && file.district.slug !== expectedSlug) problems.push(`district.slug "${file.district.slug}" does not match the file name "${expectedSlug}"`);
  const p = file.provenance;
  if (!p || typeof p !== 'object') problems.push('provenance is missing');
  else {
    if (p.isSynthetic !== false) problems.push('provenance.isSynthetic must be false: synthetic data is never served as offline NASA data');
    if (p.source !== 'NASA POWER') problems.push(`provenance.source is "${p.source}", expected "NASA POWER"`);
    for (const key of ['retrievedAt', 'startDate', 'endDate']) if (typeof p[key] !== 'string') problems.push(`provenance.${key} is missing`);
  }
  if (JSON.stringify(file.columns) !== JSON.stringify(COLUMNS)) problems.push(`columns must be ${JSON.stringify(COLUMNS)}`);
  const rows = file.rows;
  if (!Array.isArray(rows) || rows.length === 0) problems.push('rows is empty or missing');
  else {
    let prev = '';
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      if (!Array.isArray(r) || r.length !== COLUMNS.length || !ISO_DATE.test(r[0]) || !r.slice(1).every(isNumOrNull)) {
        problems.push(`row ${i} is malformed`);
        break;
      }
      if (r[0] <= prev) {
        problems.push(`row ${i} (${r[0]}) is not after the previous date: dates must be strictly ascending with no duplicates`);
        break;
      }
      prev = r[0];
    }
    if (p && typeof p.startDate === 'string' && rows[0]?.[0] < p.startDate) problems.push('rows start before provenance.startDate');
    if (p && typeof p.endDate === 'string' && rows[rows.length - 1]?.[0] > p.endDate) problems.push('rows run past provenance.endDate');
  }
  if (!problems.length) {
    if (file.sha256 !== fileSha256(file.provenance, file.rows)) problems.push('sha256 does not match: the file was changed after export (or is corrupt)');
    if (file.seriesSha256 !== rowsSha256(file.rows)) problems.push('seriesSha256 does not match the rows');
  }
  return problems.length ? { ok: false, problems } : { ok: true, file };
}

// Reads every <slug>.json in dir. Returns { dir, entries: Map(slug -> file), problems: [{ slug, problems }], manifest }.
// A missing directory is not an error: it simply yields no entries.
export function loadOfflineStore(dir = DEFAULT_OFFLINE_DIR) {
  const entries = new Map();
  const problems = [];
  let names = [];
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'manifest.json').sort();
  } catch {
    return { dir, entries, problems, manifest: null };
  }
  for (const name of names) {
    const slug = name.slice(0, -5);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      problems.push({ slug, problems: [`cannot read or parse: ${err.message}`] });
      continue;
    }
    const result = validateOfflineFile(parsed, slug);
    if (result.ok) entries.set(slug, result.file);
    else problems.push({ slug, problems: result.problems });
  }
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  } catch {
    // The manifest is informational; the per-file hashes are what protect the data.
  }
  return { dir, entries, problems, manifest };
}

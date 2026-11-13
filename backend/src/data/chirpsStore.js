// Read and write the committed CHIRPS files (one per district) made by `npm run fetch:chirps`.
//
// A file holds the daily CHIRPS rainfall (area average over one polygon) of ONE district exactly as ClimateSERV returned it,
// plus the provenance needed to repeat or question it. Like the offline POWER files they are never edited by hand: a sha256
// over provenance + rows detects that, and a file that fails any check is refused with the reason, not repaired.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHIRPS_FORMAT = 'field-shift-chirps-climateserv/1';
export const CHIRPS_COLUMNS = ['date', 'precipMm'];
export const DEFAULT_CHIRPS_DIR = fileURLToPath(new URL('../../data/chirps/', import.meta.url));

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const hashOf = (provenance, rows) => sha256(JSON.stringify({ provenance, rows }));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function buildChirpsFile({ district, provenance, series }) {
  const rows = series.map((r) => [r.date, r.precipMm]);
  return {
    format: CHIRPS_FORMAT,
    district: { slug: district.slug, nameEn: district.nameEn, latitude: district.latitude, longitude: district.longitude },
    provenance,
    columns: CHIRPS_COLUMNS,
    rows,
    sha256: hashOf(provenance, rows),
  };
}

export function validateChirpsFile(file, expectedSlug) {
  const problems = [];
  if (!file || typeof file !== 'object') return ['not a JSON object'];
  if (file.format !== CHIRPS_FORMAT) problems.push(`format must be ${CHIRPS_FORMAT}`);
  if (file.district?.slug !== expectedSlug) problems.push(`district.slug is ${file.district?.slug}, expected ${expectedSlug}`);
  if (file.provenance?.isSynthetic !== false) problems.push('provenance.isSynthetic must be false (fixtures never go in this folder)');
  if (!Array.isArray(file.rows) || file.rows.length === 0) return [...problems, 'rows is empty'];
  let previous = null;
  for (const [i, row] of file.rows.entries()) {
    const [date, value] = Array.isArray(row) ? row : [];
    if (typeof date !== 'string' || !ISO.test(date)) { problems.push(`row ${i}: bad date`); break; }
    if (previous && Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`) !== 86400000) { problems.push(`row ${i}: ${date} does not follow ${previous} (not a clean daily series)`); break; }
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) { problems.push(`row ${i}: bad value`); break; }
    previous = date;
  }
  if (!problems.length && file.sha256 !== hashOf(file.provenance, file.rows)) problems.push('sha256 does not match (file was edited)');
  return problems;
}

export function chirpsPath(slug, dir = DEFAULT_CHIRPS_DIR) {
  return path.join(dir, `${slug}.json`);
}

export function writeChirpsFile(file, dir = DEFAULT_CHIRPS_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  const target = chirpsPath(file.district.slug, dir);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(file)}\n`);
  fs.renameSync(tmp, target); // never leave a half-written file behind
  return target;
}

// Returns { file, series } or throws an Error listing every problem.
export function loadChirpsFile(slug, dir = DEFAULT_CHIRPS_DIR) {
  const target = chirpsPath(slug, dir);
  if (!fs.existsSync(target)) throw new Error(`No CHIRPS file for ${slug} at ${target}. Run: npm run fetch:chirps -- --district=${slug}`);
  const file = JSON.parse(fs.readFileSync(target, 'utf8'));
  const problems = validateChirpsFile(file, slug);
  if (problems.length) throw new Error(`${target} is not valid: ${problems.join('; ')}`);
  return { file, series: file.rows.map(([date, precipMm]) => ({ date, precipMm, tMaxC: null, tMinC: null, measurements: null })) };
}

// ---- the cross-check provider used by the API -------------------------------------------------------------------
// Reads the report written by `npm run compare:chirps` (data/chirps/compare-<slug>.json) and returns the small summary for one
// crop, or null when there is no report. A report that is unreadable or malformed is ignored (with one warning), never guessed at:
// the advisory then simply carries no cross-check.
import { crossCheckSummary } from '../science/sourceComparison.js';

const reportOk = (r) => r && typeof r === 'object' && r.crops && typeof r.crops === 'object'
  && Object.values(r.crops).every((c) => c?.verdicts?.a && c?.verdicts?.b && c?.summary && c?.firstDayShare);

export function createCrossCheckProvider(dir = DEFAULT_CHIRPS_DIR, { warn = console.warn } = {}) {
  const cache = new Map(); // slug -> { mtimeMs, report }
  const warned = new Set();
  return function crossCheckFor(slug, cropSlug) {
    const target = path.join(dir, `compare-${slug}.json`);
    let stat;
    try { stat = fs.statSync(target); } catch { return null; }
    let entry = cache.get(slug);
    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      let report = null;
      try {
        report = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (!reportOk(report)) { report = null; throw new Error('unexpected shape'); }
      } catch (error) {
        if (!warned.has(slug)) { warned.add(slug); warn(`Ignoring ${target}: ${error.message}`); }
      }
      entry = { mtimeMs: stat.mtimeMs, report };
      cache.set(slug, entry);
    }
    return entry.report ? crossCheckSummary(entry.report, cropSlug) : null;
  };
}

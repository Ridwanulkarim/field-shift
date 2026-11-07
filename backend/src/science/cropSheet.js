// Reads the crop-trait sourcing sheet (docs/templates/crop-traits-sourcing.csv, filled in by teammates) and decides, row by
// row, which values may be treated as VERIFIED. Pure functions: no files, no database, so every rule is unit-tested.
//
// THE RULE THIS ENFORCES: a number is verified only when a named source, the page or table it appears on, the region or
// variety it applies to, and a second person who checked it are all recorded. Anything less stays UNVERIFIED and keeps that
// label in every API response. This code never decides that a value is right; it only refuses to call a value verified
// without the evidence a reviewer needs to check it. Values suggested by an AI assistant are not sources.
//
// This step is READ-ONLY: it reports problems and lists what would be approved. It does not change crops.js.

import { parse as parseCsvLib } from './csv.js';

export const SHEET_COLUMNS = Object.freeze([
  'crop_slug', 'crop_name_en', 'trait', 'unit_or_scale', 'trait_meaning', 'current_value_UNVERIFIED', 'verified_value', 'status',
  'source_title', 'source_organisation', 'source_year_or_edition', 'source_url', 'page_or_table', 'region_or_variety_it_applies_to',
  'reviewer', 'review_date', 'notes',
]);

export const STATUSES = Object.freeze(['unverified', 'verified', 'disputed', 'no_source_found']);

// What each trait may hold. `int` = whole number in range; `number` = any number in range.
export const TRAITS = Object.freeze({
  startMonth: { kind: 'int', min: 1, max: 12 },
  endMonth: { kind: 'int', min: 1, max: 12 },
  waterNeedMmMin: { kind: 'number', min: 50, max: 5000 },
  waterNeedMmMax: { kind: 'number', min: 50, max: 5000 },
  heatThresholdC: { kind: 'number', min: 20, max: 50 },
  heatSensitivity: { kind: 'int', min: 1, max: 5 },
  salinityTolerance: { kind: 'int', min: 1, max: 5 },
  waterloggingTolerance: { kind: 'int', min: 1, max: 5 },
  inputIntensity: { kind: 'int', min: 1, max: 5 },
});

const REQUIRED_FOR_VERIFIED = Object.freeze([
  ['source_title', 'source title'],
  ['source_organisation', 'source organisation'],
  ['source_year_or_edition', 'source year or edition'],
  ['page_or_table', 'page or table'],
  ['region_or_variety_it_applies_to', 'region or variety it applies to'],
  ['reviewer', 'reviewer'],
  ['review_date', 'review date'],
]);

const AI_PATTERN = /\b(claude|chatgpt|gpt-?\d*|gemini|copilot|llm|ai assistant|language model|anthropic|openai)\b/i;

export function parseCsv(text) {
  return parseCsvLib(text);
}

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

function isoDateOk(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

// Checks one value against its trait's type and range. Returns { ok, value } or { ok: false, message }.
export function checkTraitValue(trait, raw) {
  const spec = TRAITS[trait];
  if (!spec) return { ok: false, message: `Unknown trait "${trait}".` };
  const s = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, message: `"${s}" is not a plain number (enter it exactly as the source gives it, without units).` };
  const value = Number(s);
  if (spec.kind === 'int' && !Number.isInteger(value)) return { ok: false, message: `${trait} must be a whole number.` };
  if (value < spec.min || value > spec.max) return { ok: false, message: `${trait} must be between ${spec.min} and ${spec.max}; got ${value}.` };
  return { ok: true, value };
}

// text: the CSV. crops: the CROPS array (slug + current values) used to check the sheet matches the code.
export function validateCropSheet(text, { crops, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const warnings = [];
  const approved = [];
  const add = (list, line, row, message) => list.push({ line, crop: row?.crop_slug ?? null, trait: row?.trait ?? null, message });

  let table;
  try {
    table = parseCsv(text);
  } catch (err) {
    return { ok: false, errors: [{ line: null, crop: null, trait: null, message: `The file is not valid CSV: ${err.message}` }], warnings, approved, summary: null };
  }
  const [header = [], ...body] = table;
  const missingCols = SHEET_COLUMNS.filter((c) => !header.includes(c));
  if (missingCols.length) {
    return { ok: false, errors: [{ line: 1, crop: null, trait: null, message: `Missing column(s): ${missingCols.join(', ')}.` }], warnings, approved, summary: null };
  }
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  const cropBySlug = new Map(crops.map((c) => [c.slug, c]));
  const seen = new Set();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const perCrop = new Map(crops.map((c) => [c.slug, { verified: 0, total: 0 }]));
  let rowCount = 0;

  body.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every(blank)) return; // empty line
    rowCount += 1;
    const row = Object.fromEntries(SHEET_COLUMNS.map((name) => [name, (cells[col[name]] ?? '').trim()]));
    const err = (m) => add(errors, line, row, m);

    const crop = cropBySlug.get(row.crop_slug);
    if (!crop) return err(`Unknown crop "${row.crop_slug}".`);
    if (!(row.trait in TRAITS)) return err(`Unknown trait "${row.trait}".`);
    const key = `${row.crop_slug}/${row.trait}`;
    if (seen.has(key)) return err(`Duplicate row for ${key}.`);
    seen.add(key);
    perCrop.get(row.crop_slug).total += 1;

    // The sheet must describe the same "current" value as the code, otherwise it was edited or is out of date.
    if (String(crop[row.trait]) !== row.current_value_UNVERIFIED) {
      add(warnings, line, row, `current_value_UNVERIFIED is "${row.current_value_UNVERIFIED}" but the code has "${crop[row.trait]}". Do not edit that column; re-export the template if the code changed.`);
    }

    let status = row.status;
    if (blank(status)) {
      status = 'unverified';
      add(warnings, line, row, 'status is blank; treated as "unverified".');
    }
    if (!STATUSES.includes(status)) return err(`status must be one of ${STATUSES.join(', ')}; got "${status}".`);
    byStatus[status] += 1;

    const hasValue = !blank(row.verified_value);
    if (status === 'unverified' || status === 'no_source_found') {
      if (hasValue) err(`status is "${status}" but verified_value is filled in. A value is used only when the status is "verified".`);
      return undefined;
    }
    if (status === 'disputed') {
      if (blank(row.notes)) err('A disputed row must record both values and both sources in notes.');
      return undefined; // never approved
    }

    // status === 'verified'
    const problems = [];
    if (!hasValue) problems.push('verified_value is empty');
    else {
      const checked = checkTraitValue(row.trait, row.verified_value);
      if (!checked.ok) problems.push(checked.message);
    }
    for (const [name, label] of REQUIRED_FOR_VERIFIED) if (blank(row[name])) problems.push(`${label} is missing`);
    if (!blank(row.review_date)) {
      if (!isoDateOk(row.review_date)) problems.push('review_date must be a real date, YYYY-MM-DD');
      else if (row.review_date > today) problems.push('review_date is in the future');
    }
    if (!blank(row.source_url) && !/^https?:\/\/\S+$/.test(row.source_url)) problems.push('source_url must start with http:// or https://');
    for (const name of ['source_title', 'source_organisation', 'reviewer']) {
      if (AI_PATTERN.test(row[name])) problems.push(`${name} names an AI assistant; an AI assistant is not a source or a reviewer`);
    }
    if (problems.length) {
      err(`Marked "verified" but rejected: ${problems.join('; ')}.`);
      return undefined;
    }
    perCrop.get(row.crop_slug).verified += 1;
    approved.push({
      slug: row.crop_slug,
      trait: row.trait,
      value: Number(row.verified_value),
      replaces: crop[row.trait],
      citation: {
        title: row.source_title, organisation: row.source_organisation, yearOrEdition: row.source_year_or_edition,
        url: blank(row.source_url) ? null : row.source_url, pageOrTable: row.page_or_table,
        appliesTo: row.region_or_variety_it_applies_to, reviewer: row.reviewer, reviewDate: row.review_date, notes: blank(row.notes) ? null : row.notes,
      },
    });
    return undefined;
  });

  // Coverage and cross-trait checks.
  for (const c of crops) {
    for (const trait of Object.keys(TRAITS)) {
      if (!seen.has(`${c.slug}/${trait}`)) add(warnings, null, { crop_slug: c.slug, trait }, `No row for ${c.slug}/${trait}.`);
    }
    const mine = approved.filter((a) => a.slug === c.slug);
    const min = mine.find((a) => a.trait === 'waterNeedMmMin');
    const max = mine.find((a) => a.trait === 'waterNeedMmMax');
    if (min && max && min.value > max.value) add(errors, null, { crop_slug: c.slug, trait: 'waterNeedMmMin' }, `waterNeedMmMin (${min.value}) is greater than waterNeedMmMax (${max.value}).`);
    if ((min && !max) || (max && !min)) add(warnings, null, { crop_slug: c.slug, trait: 'waterNeedMmMin' }, 'Only one of waterNeedMmMin / waterNeedMmMax is verified; the other keeps its UNVERIFIED value, so the pair may be inconsistent.');
  }

  const summary = {
    rows: rowCount,
    byStatus,
    approvedCount: approved.length,
    rejectedCount: errors.filter((e) => e.line !== null).length,
    crops: [...perCrop].map(([slug, v]) => ({ slug, verified: v.verified, rowsInSheet: v.total, traits: Object.keys(TRAITS).length })),
  };
  return { ok: errors.length === 0, errors, warnings, approved, summary };
}

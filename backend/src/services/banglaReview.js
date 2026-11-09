// Builds the sheet a native Bangla speaker reviews: every Bangla sentence the backend can produce, next to its English
// original, in a form a non-programmer can open in a spreadsheet and fill in.
//
// The sentences come from the REAL code paths (the advisory and the field summary), run on FIXTURE data. The numbers in
// the examples (days, years, mm) are invented to show the wording; they are NOT NASA results and the reviewer is asked to
// judge wording, not numbers. Nothing here changes any sentence: reviewers' corrections are applied by a developer.

import { createEvaluationService } from './evaluationService.js';
import { buildAdvisory } from '../science/plantingAdvisory.js';
import { buildFieldSummary, buildFieldSummaryBn, MONTHS_BN } from '../science/fieldSummary.js';
import { DISTRICTS } from '../data/reference/districts.js';
import { CROPS } from '../data/reference/crops.js';
import { PRIORITIES, EXPERIMENTAL_CROPS, NOT_MODELED } from '../science/rules.js';
import { buildSms } from '../science/smsAdvisory.js';

export const REVIEW_COLUMNS = Object.freeze(['id', 'group', 'situation', 'english', 'bangla_draft', 'verdict', 'corrected_bangla', 'reviewer', 'review_date', 'notes']);
// verdict values the reviewer may enter
export const VERDICTS = Object.freeze(['ok', 'change', 'unclear_english']);

const ID_PREFIX = { advisory: 'A', farmer_sentence: 'S', field_summary: 'F', district_name: 'D', crop_name: 'C', priority_label: 'P', month_name: 'M', sms: 'T', note: 'N' };
const isoDate = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
function buildSeries(first, last, fn) {
  const out = [];
  for (let t = Date.UTC(first, 0, 1); t <= Date.UTC(last, 11, 31); t += 86400000) {
    const dt = new Date(t);
    const y = dt.getUTCFullYear(); const m = dt.getUTCMonth() + 1; const d = dt.getUTCDate();
    out.push({ date: isoDate(y, m, d), ...fn(y, m, d), tMinC: 22 });
  }
  return out;
}
// Rain of 10 mm a day from `start(year)` to the end of August.
const rainFromJune = (startDay) => (y, m, d) => ({ precipMm: m <= 8 && (m > 6 || (m === 6 && d >= startDay(y))) ? 10 : 0, tMaxC: 32 });
const rainFromMay = (startDay) => (y, m, d) => ({ precipMm: m >= 6 || (m === 5 && d >= startDay(y)) ? (m <= 8 ? 10 : 0) : 0, tMaxC: 32 });

const SCENARIOS = [
  { id: 'delay', crop: 'aman', series: () => buildSeries(2001, 2025, rainFromJune((y) => (y < 2013 ? 10 : 27) + (y % 4))), usual: null, situation: 'Usable rain now starts LATER (supported shift); farmer gave no usual window' },
  { id: 'delay_window', crop: 'aman', series: () => buildSeries(2001, 2025, rainFromJune((y) => (y < 2013 ? 10 : 27) + (y % 4))), usual: { from: '07-15', to: '08-15' }, situation: 'Usable rain starts LATER; farmer gave a usual window (15 July to 15 August), shown moved' },
  { id: 'advance_window', crop: 'aman', series: () => buildSeries(2001, 2025, rainFromJune((y) => (y < 2013 ? 27 : 10) + (y % 4))), usual: { from: '07-15', to: '08-15' }, situation: 'Usable rain starts EARLIER; farmer gave a usual window' },
  { id: 'no_change_window', crop: 'aman', series: () => buildSeries(2001, 2025, rainFromJune((y) => 10 + (y % 4))), usual: { from: '07-15', to: '08-15' }, situation: 'No clear change; farmer gave a usual window (stays as it is); includes the "cannot be ruled out" sentence' },
  { id: 'aus_advance', crop: 'aus', series: () => buildSeries(2001, 2025, rainFromMay((y) => (y < 2013 ? 22 : 8) + (y % 4))), usual: null, situation: 'Aus (onset searched from May): earlier start; includes the note that May rainfall was not confirmed by an independent source' },
];

async function adviceFor(scenario) {
  const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
  const series = scenario.series();
  // The advisory refuses synthetic data by design, so the fixture is passed through as "not synthetic" here. This is safe
  // only because the sentences do not depend on provenance and no provenance is written to the sheet.
  const repo = {
    listDistricts: async () => districts,
    getDistrictBySlug: async (s) => districts.find((d) => d.slug === s) ?? null,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
    getClimate: async () => ({ provenance: { runId: 1, source: 'FIXTURE (not NASA data)', isSynthetic: false, retrievedAt: '2026-01-01T00:00:00Z', startDate: '2001-01-01', endDate: '2025-12-31', units: {} }, series }),
  };
  const service = createEvaluationService(repo);
  return service.advisory('rajshahi', { crop: scenario.crop, splitYear: null, lang: 'en', usual: scenario.usual, includeHeat: false });
}

export async function buildBanglaReviewRows() {
  const rows = [];
  const add = (group, situation, english, bangla) => rows.push({
    id: `${ID_PREFIX[group]}${String(rows.filter((r) => r.group === group).length + 1).padStart(2, '0')}`,
    group, situation, english, bangla_draft: bangla, verdict: '', corrected_bangla: '', reviewer: '', review_date: '', notes: '',
  });

  // A. Advisory sentences, one per decision type (hand-made decisions, example numbers).
  const base = { districtEn: 'Rajshahi', districtBn: 'রাজশাহী', cropEn: 'Aman rice', cropBn: 'আমন ধান', periods: { early: { from: 2001, to: 2012 }, late: { from: 2013, to: 2025 } } };
  const rec = (over) => ({ action: 'none', shiftDays: null, confidence: 'none', reason: 'no_distinguishable_shift', ...over });
  const kinds = [
    ['Planting advice: later start (example: 11 days)', rec({ action: 'delay', shiftDays: 11, confidence: 'supported', reason: 'supported' })],
    ['Planting advice: earlier start (example: 9 days)', rec({ action: 'advance', shiftDays: 9, confidence: 'supported', reason: 'supported' })],
    ['No clear change', rec({})],
    ['Change seen but depends on the definition (no advice)', rec({ reason: 'sensitive_to_definition', confidence: 'weak' })],
    ['Many years start on the first day examined (no advice)', rec({ reason: 'start_boundary_saturated', confidence: 'weak' })],
    ['Not enough years of data', rec({ reason: 'insufficient_data' })],
    ['No rain-start advice exists for this crop (for example Boro)', rec({ reason: 'onset_not_applicable', confidence: 'not_applicable' })],
  ];
  for (const [situation, recommendation] of kinds) {
    const t = buildAdvisory({ ...base, recommendation, periods: base.periods });
    add('advisory', situation, t.en, t.bn);
  }

  // B. The full advisory sentence as a farmer would see it (includes the district, medians, the window and the caveats).
  for (const sc of SCENARIOS) {
    const adv = await adviceFor(sc);
    add('farmer_sentence', sc.situation, adv.sentence.en, adv.sentence.bn);
  }

  // B2. SMS-length versions (at most 160 characters; Bangla is sent as UCS-2, so it costs more than one SMS part).
  const smsBase = { district: { en: 'Rajshahi', bn: 'রাজশাহী' }, crop: { en: 'Aman rice', bn: 'আমন ধান' }, n: 11, periods: base.periods, estimate: { interval95Days: [-8.4, 7.6] }, window: null, experimental: false };
  for (const [situation, kind] of [['SMS: later start (example: 11 days)', 'delay'], ['SMS: earlier start (example: 11 days)', 'advance'], ['SMS: no clear change, with uncertainty', 'no_change'], ['SMS: depends on the definition (no advice)', 'weak'], ['SMS: many years start on the first day examined', 'saturated'], ['SMS: not enough data', 'insufficient_data'], ['SMS: no rain-start advice for this crop', 'not_applicable']]) {
    const sms = buildSms({ ...smsBase, kind });
    add('sms', situation, sms.en, sms.bn);
  }
  const smsAus = buildSms({ ...smsBase, kind: 'advance', crop: { en: 'Aus rice', bn: 'আউশ ধান' }, experimental: true });
  add('sms', 'SMS: Aus (experimental label at the start)', smsAus.en, smsAus.bn);

  // B3. Notes shown next to results.
  add('note', 'Warning shown on every Aus advisory', EXPERIMENTAL_CROPS.aus.en, EXPERIMENTAL_CROPS.aus.bn);
  for (const f of NOT_MODELED) add('note', 'Factor listed as NOT modelled in the rotation tool', f.en, f.bn);

  // C. Field summary paragraph (a registered field), two situations.
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rainMm: { mean: i === 6 ? 300 : i === 0 ? 5 : 100, median: 0, years: 20 } }));
  const fcrop = (nameEn, nameBn, atMinNeed, compatibility = 'within_tolerance') => ({ nameEn, nameBn, seasonRain: { shortfallMm: { atMinNeed, atMaxNeed: atMinNeed } }, salinity: { compatibility } });
  const fieldArgs = { monthly, crops: [fcrop('Boro rice', 'বোরো ধান', 40), fcrop('Aman rice', 'আমন ধান', 0)], cell: { approxAreaKm2: 3500 }, areaHa: 1.2, soil: { salinityClass: null, salinityDsM: null }, spansMultipleCells: false };
  add('field_summary', 'Field summary: no soil salinity entered', buildFieldSummary(fieldArgs), buildFieldSummaryBn(fieldArgs));
  const salty = { ...fieldArgs, soil: { salinityClass: 'moderate', salinityDsM: 5 }, crops: [fcrop('Aman rice', 'আমন ধান', 0, 'exceeds_tolerance')], spansMultipleCells: true };
  add('field_summary', 'Field summary: salinity above a crop\'s tolerance, field crosses a grid-cell edge', buildFieldSummary(salty), buildFieldSummaryBn(salty));

  // D. Names and labels shown in the interface.
  for (const d of DISTRICTS) add('district_name', 'District name', d.nameEn, d.nameBn);
  for (const c of CROPS) add('crop_name', 'Crop name', c.nameEn, c.nameBn);
  for (const p of PRIORITIES) add('priority_label', 'Farmer priority label', p.labelEn, p.labelBn);
  MONTHS_BN.forEach((m, i) => add('month_name', 'Month name used in sentences', new Date(Date.UTC(2001, i, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), m));
  return rows;
}

// RFC 4180 CSV with a UTF-8 byte-order mark so Excel opens the Bangla correctly.
export function toCsv(rows) {
  const q = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return `﻿${[REVIEW_COLUMNS.join(','), ...rows.map((r) => REVIEW_COLUMNS.map((c) => q(r[c])).join(','))].join('\r\n')}\r\n`;
}

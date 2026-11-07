// The farmer-facing advisory: the planting-window analysis turned into ONE decision, the two distributions that
// support it, and a plain sentence in English and Bangla. Pure functions: no database, no HTTP, no clock.
//
// Nothing here decides anything new. The action, the size in days and the confidence come from decideShift() in
// plantingWindow.js; this module only presents them with their evidence. Every number in a sentence is computed from the
// result. A "revised window" is the FARMER'S OWN usual window moved by the supported shift; it is not an agronomically
// derived transplanting window, and the response says so. Growing degree days are reported as evidence only and never
// change the decision.
//
// The Bangla text is a first draft and must be reviewed by a native speaker before it is shown to farmers.

import { addDays } from './series.js';
import { round } from './stats.js';
import { toBnDigits, SOURCE_CAVEAT_EN, SOURCE_CAVEAT_BN, buildAdvisory } from './plantingAdvisory.js';
import { ONSET_CENSOR_DAY, GDD, SHIFT_ROBUST_SHARE, BOUNDARY_SATURATED_SHARE } from './rules.js';

const REF_YEAR = 2001; // a non-leap year: the onset analysis uses a 365-day calendar
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
export const MAX_USUAL_WINDOW_DAYS = 120;

// Day of a 365-day year (1 = 1 January) -> 'MM-DD'.
export function monthDayFromDay365(day) {
  if (!Number.isInteger(day) || day < 1 || day > 365) throw new RangeError(`Day of year must be 1..365; got ${day}.`);
  return addDays(`${REF_YEAR}-01-01`, day - 1).slice(5);
}

// 'MM-DD' -> { month, day } or null when it is not a real calendar date (29 February is not accepted).
export function parseMonthDay(text) {
  if (typeof text !== 'string' || !/^\d{2}-\d{2}$/.test(text)) return null;
  const month = Number(text.slice(0, 2));
  const day = Number(text.slice(3, 5));
  const iso = `${REF_YEAR}-${text}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return null;
  return { month, day };
}

export function shiftMonthDay(text, days) {
  return addDays(`${REF_YEAR}-${text}`, days).slice(5);
}

export function formatMonthDay(text, lang) {
  const { month, day } = parseMonthDay(text);
  return lang === 'bn' ? `${toBnDigits(day)} ${MONTHS_BN[month - 1]}` : `${day} ${MONTHS_EN[month - 1]}`;
}

// Linear-interpolation quantile of an ascending array.
export function quantile(sorted, p) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return { n: 0, min: null, q1: null, median: null, q3: null, max: null };
  return { n: sorted.length, min: sorted[0], q1: quantile(sorted, 0.25), median: quantile(sorted, 0.5), q3: quantile(sorted, 0.75), max: sorted[sorted.length - 1] };
}

// Two onset distributions from the yearly onset list. Years with no onset before the end of the search season are
// counted as censored and NOT put in the quartiles (their true onset is later than anything seen); unknown years
// (too many unobserved days) are counted and left out.
export function onsetDistributions(yearly, splitYear) {
  const side = (inPeriod) => {
    const rows = yearly.filter((y) => inPeriod(y.year));
    const confirmed = rows.filter((y) => y.status === 'onset' && Number.isFinite(y.value) && !y.earlierWindowsUnobserved);
    const values = confirmed.map((y) => y.value).sort((a, b) => a - b);
    const s = summarize(values);
    const date = (v) => (v === null ? null : monthDayFromDay365(Math.min(365, Math.max(1, Math.round(v)))));
    return {
      years: rows.length,
      confirmedYears: confirmed.length,
      censoredYears: rows.filter((y) => y.status === 'no_onset').length,
      unknownYears: rows.filter((y) => y.status === 'unknown' || y.earlierWindowsUnobserved).length,
      valuesDayOfYear: values,
      summary: { ...s, q1Date: date(s.q1), medianDate: date(s.median), q3Date: date(s.q3) },
    };
  };
  return { unit: 'day of a 365-day year (1 January = 1)', early: side((y) => y < splitYear), late: side((y) => y >= splitYear) };
}

function gddEvidence(analysis) {
  const g = analysis?.gdd;
  if (!g) return null;
  const okValues = (inPeriod) => g.yearly.filter((y) => y.status === 'ok' && inPeriod(y.year)).map((y) => y.value);
  const split = g.analysis.splitYear;
  return {
    metric: `growing degree days over the crop's months (base ${g.parameters.baseC} C, cap ${g.parameters.capC} C)`,
    verdict: g.analysis.verdict,
    earlyMedianGdd: g.analysis.earlyMedian,
    lateMedianGdd: g.analysis.lateMedian,
    shiftGdd: g.analysis.shiftGdd === null ? null : round(g.analysis.shiftGdd, 1),
    pValue: g.analysis.test ? round(g.analysis.test.pValue, 4) : null,
    early: summarize(okValues((y) => y < split)),
    late: summarize(okValues((y) => y >= split)),
    usedInDecision: false,
    parameterBasis: 'UNVERIFIED_GENERAL_KNOWLEDGE',
    cropSpecific: false,
    note: `Experimental evidence only, never used in the decision. The base temperature (${GDD.baseC} C) and upper cap (${GDD.capC} C) are unverified general values, not sourced for this crop or variety. A heat result alone does not change the planting advice.`,
  };
}

// The years that actually went into the comparison, which can differ from the span of years in the series:
// a year is USED when its onset was confirmed with every earlier window observed, or when it was fully observed with
// no qualifying rain (kept as censored). A year whose season was not fully observed (data gap, or data that end
// before the season is over) is EXCLUDED, never counted as a complete year.
export function usedYears(result) {
  const split = result.periods.splitYear;
  if (!result.onset.applies) return { periods: result.periods, excluded: [] };
  const yearly = result.onset.yearly;
  const isUsed = (y) => (y.status === 'onset' && !y.earlierWindowsUnobserved) || y.status === 'no_onset';
  const range = (inPeriod, fallback) => {
    const ys = yearly.filter((y) => isUsed(y) && inPeriod(y.year)).map((y) => y.year);
    return ys.length ? { from: Math.min(...ys), to: Math.max(...ys), years: ys.length } : fallback;
  };
  const excluded = yearly.filter((y) => !isUsed(y)).map((y) => ({
    year: y.year,
    reason: y.earlierWindowsUnobserved
      ? 'An earlier onset cannot be ruled out because earlier rain windows were not observed.'
      : 'The rain season was not fully observed (a data gap, or the data end before the season is over).',
  }));
  return {
    periods: { splitYear: split, early: range((y) => y < split, result.periods.early), late: range((y) => y >= split, result.periods.late) },
    excluded,
  };
}

// Size of the shift with an interval, so "no distinguishable shift" is not misread as "no shift".
// Hodges-Lehmann estimate = median of all late-minus-early differences; the interval is the usual distribution-free
// 95% interval from the Mann-Whitney statistic (normal approximation to the critical value, ties tolerated).
// Years without an onset are entered at the censor day, exactly as in the test, so the two always agree.
export function shiftEstimate(yearly, splitYear, censorValue = ONSET_CENSOR_DAY) {
  const pts = [];
  for (const y of yearly) {
    if (y.status === 'onset' && !y.earlierWindowsUnobserved && Number.isFinite(y.value)) pts.push({ year: y.year, value: y.value });
    else if (y.status === 'no_onset') pts.push({ year: y.year, value: censorValue });
  }
  const early = pts.filter((p) => p.year < splitYear).map((p) => p.value);
  const late = pts.filter((p) => p.year >= splitYear).map((p) => p.value);
  if (early.length < 3 || late.length < 3) return null;
  const diffs = [];
  for (const e of early) for (const l of late) diffs.push(l - e);
  diffs.sort((a, b) => a - b);
  const nm = early.length * late.length;
  const k = Math.max(0, Math.floor(nm / 2 - 1.959964 * Math.sqrt((nm * (early.length + late.length + 1)) / 12)));
  const mid = Math.floor(nm / 2);
  const hl = nm % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
  return {
    method: 'Hodges-Lehmann estimate with a distribution-free 95% interval',
    estimateDays: round(hl, 1),
    interval95Days: [diffs[k], diffs[nm - 1 - k]],
    earlyYears: early.length,
    lateYears: late.length,
  };
}

const describeShift = (d, lang) => {
  if (lang === 'bn') return d < 0 ? `${toBnDigits(-d)} দিন আগে` : d > 0 ? `${toBnDigits(d)} দিন দেরিতে` : 'কোনো পরিবর্তন নয়';
  return d < 0 ? `${-d} days earlier` : d > 0 ? `${d} days later` : 'no change';
};

function intervalSentence(est) {
  const lo = Math.floor(est.interval95Days[0]);
  const hi = Math.ceil(est.interval95Days[1]);
  return {
    en: ` The data are limited (${est.earlyYears} and ${est.lateYears} years), so a shift anywhere from ${describeShift(lo, 'en')} to ${describeShift(hi, 'en')} cannot be ruled out.`,
    bn: ` তথ্য সীমিত (${toBnDigits(est.earlyYears)} ও ${toBnDigits(est.lateYears)} বছর), তাই ${describeShift(lo, 'bn')} থেকে ${describeShift(hi, 'bn')} পর্যন্ত পরিবর্তন বাদ দেওয়া যায় না।`,
  };
}

const CONFIDENCE_MEANING = {
  supported: 'A shift was found (p below 0.05 and at least 1 day), and at least 60% of the alternative onset definitions reach the same verdict.',
  weak: 'Something was seen but it is not reliable: it depends on how "usable rain" is defined, or many years start on the first day the analysis can examine, so no planting advice is given.',
  none: 'No shift was distinguished from year-to-year variation, or there are too few usable years. This is NOT a statement that nothing changed: see evidence.strength.shiftEstimate for the shifts the data cannot rule out.',
  not_applicable: 'No rainfall-onset rule is defined for this crop.',
};

const rangeText = (p) => `${p.from}–${p.to}`;

function headline({ kind, n, periods, dates, district, crop, window }) {
  const early = rangeText(periods.early);
  const late = rangeText(periods.late);
  const dir = kind === 'delay' ? { en: 'later', bn: 'দেরিতে', verbEn: 'later', verbBn: 'পিছিয়ে' } : { en: 'earlier', bn: 'আগে', verbEn: 'earlier', verbBn: 'এগিয়ে' };
  const evEn = `the median start was ${formatMonthDay(dates.earlyMedian, 'en')} in ${early} and ${formatMonthDay(dates.lateMedian, 'en')} in ${late}`;
  const evBn = `${toBnDigits(early)} সালে মধ্যমান শুরু ছিল ${formatMonthDay(dates.earlyMedian, 'bn')}, আর ${toBnDigits(late)} সালে ${formatMonthDay(dates.lateMedian, 'bn')}`;
  const actEn = window
    ? `If your usual transplanting window is ${formatMonthDay(window.usual.from, 'en')} to ${formatMonthDay(window.usual.to, 'en')}, consider ${formatMonthDay(window.revised.from, 'en')} to ${formatMonthDay(window.revised.to, 'en')}.`
    : `Consider moving transplanting about ${n} days ${dir.verbEn}.`;
  const actBn = window
    ? `আপনার চিরাচরিত রোপণের সময় যদি ${formatMonthDay(window.usual.from, 'bn')} থেকে ${formatMonthDay(window.usual.to, 'bn')} হয়, তবে ${formatMonthDay(window.revised.from, 'bn')} থেকে ${formatMonthDay(window.revised.to, 'bn')} করার কথা ভাবুন।`
    : `রোপণের সময় প্রায় ${toBnDigits(n)} দিন ${dir.verbBn} নেওয়ার কথা ভাবুন।`;
  return {
    en: `${crop.en} in ${district.en}: usable rain now starts about ${n} days ${dir.en} (${evEn}). ${actEn} Please check with your local agricultural extension officer.${SOURCE_CAVEAT_EN}`,
    bn: `${district.bn} জেলায় ${crop.bn}: কার্যকর বৃষ্টি এখন প্রায় ${toBnDigits(n)} দিন ${dir.bn} শুরু হচ্ছে (${evBn})। ${actBn} স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।${SOURCE_CAVEAT_BN}`,
  };
}

// result: the planting-window response; analysis: the internal analysis (for growing degree days);
// lang: 'en' | 'bn' (which sentence goes in sentence.text); usual: { from: 'MM-DD', to: 'MM-DD' } | null.
export function buildFarmerAdvisory({ result, analysis, lang = 'en', usual = null, includeHeat = false }) {
  const rec = result.recommendation;
  const supported = rec.action === 'delay' || rec.action === 'advance';
  const n = rec.shiftDays;
  const shift = supported ? (rec.action === 'delay' ? n : -n) : 0;

  const { periods, excluded } = usedYears(result);
  const distributions = result.onset.applies ? onsetDistributions(result.onset.yearly, result.periods.splitYear) : null;
  const estimate = result.onset.applies ? shiftEstimate(result.onset.yearly, result.periods.splitYear) : null;
  let dates = null;
  const oa = result.onset.analysis;
  if (result.onset.applies && oa && oa.earlyMedian !== null && oa.lateMedian !== null) {
    const a = oa;
    dates = {
      earlyMedian: monthDayFromDay365(Math.round(a.earlyMedian)),
      lateMedian: monthDayFromDay365(Math.round(a.lateMedian)),
      measuredShiftDays: a.shiftDays === null ? null : round(a.shiftDays, 1),
    };
  }

  let window = null;
  if (usual) {
    window = {
      basis: 'farmer_entered_usual_window',
      usual,
      revised: { from: shiftMonthDay(usual.from, shift), to: shiftMonthDay(usual.to, shift) },
      shiftDays: shift,
      changed: shift !== 0,
      note: 'The revised window is your own usual window moved by the supported shift in the start of usable rain. It is not an agronomically derived transplanting window.',
    };
  }

  const district = { en: result.district.nameEn, bn: result.district.nameBn };
  const crop = { en: result.crop.nameEn, bn: result.crop.nameBn };
  const sentence = supported && dates
    ? headline({ kind: rec.action, n, periods, dates, district, crop, window })
    : (() => {
        const t = buildAdvisory({ districtEn: district.en, districtBn: district.bn, cropEn: crop.en, cropBn: crop.bn, recommendation: rec, periods });
        const extra = estimate && (t.kind === 'no_change' || t.kind === 'weak') ? intervalSentence(estimate) : { en: '', bn: '' };
        return { en: t.en + extra.en, bn: t.bn + extra.bn };
      })();
  const unchangedNote = window && !supported
    ? { en: ' Your usual window stays as it is.', bn: ' আপনার চিরাচরিত সময় অপরিবর্তিত থাকুক।' }
    : { en: '', bn: '' };

  const a = result.onset.analysis;
  return {
    district: result.district,
    crop: result.crop,
    decision: {
      kind: result.advisory.kind,
      action: rec.action,
      direction: rec.action === 'delay' ? 'later' : rec.action === 'advance' ? 'earlier' : 'none',
      shiftDays: rec.shiftDays,
      confidence: rec.confidence,
      confidenceMeaning: CONFIDENCE_MEANING[rec.confidence] ?? null,
      reason: rec.reason,
    },
    sentence: { text: (sentence[lang] ?? sentence.en) + (unchangedNote[lang] ?? ''), lang: sentence[lang] ? lang : 'en', en: sentence.en + unchangedNote.en, bn: sentence.bn + unchangedNote.bn, reviewStatus: result.advisory.reviewStatus },
    window,
    windowHint: window ? null : 'Add usualFrom and usualTo (MM-DD) to see your own usual transplanting window moved by this shift.',
    evidence: {
      periods,
      excludedYears: excluded,
      dataEndDate: result.provenance.endDate,
      onsetDefinition: result.onset.definition,
      onsetDates: dates,
      distributions,
      strength: a
        ? {
            pValue: a.test ? round(a.test.pValue, 4) : null,
            pValueText: a.test ? (a.test.pValue < 0.0001 ? 'less than 0.0001' : String(round(a.test.pValue, 4))) : null,
            testMethod: a.test ? a.test.method : null,
            alpha: 0.05,
            definitionsAgreeing: result.onset.sensitivity?.definitionsAgreeing ?? null,
            definitionsUsable: result.onset.sensitivity?.definitionsUsable ?? null,
            shiftDaysRange: result.onset.sensitivity?.shiftDaysRange ?? null,
            startBoundary: result.onset.boundary
              ? { saturated: result.onset.boundary.saturated, saturatedShareThreshold: BOUNDARY_SATURATED_SHARE, earlyShareAtFirstDay: result.onset.boundary.early.share, lateShareAtFirstDay: result.onset.boundary.late.share, magnitudeBias: result.onset.boundary.magnitudeBias }
              : null,
            robustShareRequired: SHIFT_ROBUST_SHARE,
            definitionsNote: 'The alternative definitions vary the rain threshold and window length on the same data and the same season start, so they are not independent checks.',
            shiftEstimate: estimate,
          }
        : null,
      heat: includeHeat ? gddEvidence(analysis) : null,
      heatNote: includeHeat ? null : 'Growing degree days are not part of this advisory. Add includeHeat=true to see them as experimental evidence; they never affect the decision.',
    },
    status: result.status,
    statusNote: 'Experimental: the onset definitions are unverified agronomic assumptions and the result rests on one modelled rainfall source. Growing degree days are excluded from the decision.',
    provenance: result.provenance,
    dataLabel: result.dataLabel,
    latestObservationDate: result.latestObservationDate ?? null,
    daysSinceLatest: result.daysSinceLatest ?? null,
    limitations: window ? [...result.limitations, window.note] : result.limitations,
    disclaimer: result.disclaimer,
  };
}

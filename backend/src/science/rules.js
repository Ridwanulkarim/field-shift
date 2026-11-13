// Every tunable number of the scientific logic lives here, with its status.
// None of these are NASA results; they are modelling choices (heuristics) that a
// domain expert should review. docs/SCIENTIFIC_METHOD.md explains each one.

// A cropping window/year is used only if at least this share of its days has data.
export const MIN_COVERAGE = 0.9;

// Seasonal rainfall TOTALS are stricter: missing days contribute nothing to a sum, so a
// year with 10% of days missing would understate rainfall by up to ~10%. Below this share
// of observed days the year is left out instead of reported as a smaller total.
export const RAIN_TOTAL_MIN_COVERAGE = 0.98;

// Dry spell: a year is reported only if the unknown days could change the longest run by
// at most this many days (longestPossible - longestKnown).
export const DRY_SPELL_MAX_UNCERTAINTY_DAYS = 7;

// Onset: a 7-day window counts as observed only if every one of its calendar days has a
// value (all windowDays). A year whose earlier windows were not fully observed, and in
// which no fully observed window qualified first, is 'unknown' (an earlier onset cannot
// be ruled out), not 'no onset'.

// Onset analysis: a year without any qualifying window is right-censored at 1 September
// (day 244 on the fixed 365-day calendar) rather than dropped.
export const ONSET_CENSOR_DAY = 244;

// "Usable rain onset": first day on/after 1 May whose 7-day rainfall total is at least
// 50 mm, searched until 31 August. HEURISTIC DEFINITION, not an official onset index.
export const ONSET = { startMonth: 5, endMonth: 8, windowDays: 7, thresholdMm: 50 };

// A day counts as "dry" below this much rain (mm/day).
export const DRY_DAY_MM = 1;

// Pre-monsoon heat day: daily maximum at or above this temperature (deg C), Mar-May.
export const PREMONSOON_HEAT_C = 35;

// Heat-fit scaling. exposure = share of crop-window days at/above the crop's heat threshold.
// heatFit = 1 - min(1, exposure * (heatSensitivity / 5) * HEAT_SCALE).
// With HEAT_SCALE = 3, a fully sensitive crop (5) with one third of days above its
// threshold scores 0. HEURISTIC.
export const HEAT_SCALE = 3;

// How much of the water gap the farmer's irrigation access is assumed to cover.
// 'none' means the gap hurts fully; 'reliable' means most of the gap can be filled.
export const IRRIGATION_ACCESS_FACTOR = { none: 1.0, limited: 0.6, reliable: 0.3 };

// Irrigation volume (mm) that scores zero on the "water saving" component.
export const WATER_SAVING_REFERENCE_MM = 1000;

// Soil inputs given by the user are turned into the tolerance a crop would need.
export const SALINITY_LEVEL = { none: 1, slight: 2, moderate: 3, high: 4 };
export const DRAINAGE_LEVEL = { good: 1, moderate: 2, poor: 4 };

// Rotation shape rules.
export const MAX_PAIR_OVERLAP_MONTHS = 1; // crops may overlap by one turnaround month
export const MIN_CROPS_ALTERNATIVE = 2;
export const MAX_CROPS = 3;
export const ALTERNATIVES_RETURNED = 3;

// Farmer priorities: each 0 (ignore) to 3 (very important), default 1.
export const PRIORITIES = [
  { key: 'waterSaving', labelEn: 'Save irrigation water', labelBn: 'সেচের পানি সাশ্রয়' },
  { key: 'heatResilience', labelEn: 'Avoid heat stress', labelBn: 'তাপজনিত ক্ষতি এড়ানো' },
  { key: 'soilHealth', labelEn: 'Look after the soil', labelBn: 'মাটির যত্ন' },
  { key: 'diversification', labelEn: 'Spread risk across crops', labelBn: 'ঝুঁকি ভাগ করা (বৈচিত্র্য)' },
  { key: 'lowInput', labelEn: 'Keep input costs low', labelBn: 'কম খরচে চাষ' },
];
export const PRIORITY_MIN = 0;
export const PRIORITY_MAX = 3;
export const PRIORITY_DEFAULT = 1;

// Base weights of the always-on components.
// croppingIntensity: months the plot is in crop / 12. stapleSecurity: staple cereal crops in the rotation / 2, capped at 1 (two cereal crops a year is the benchmark for a household that grows its own staple).
// These two were missing from the first version, which let a sparse rotation outrank the common Boro-Aman system.
// The weights are judgment calls, not fitted values; the ranking-stability check (rankingStability.js) shows how much they matter.
export const BASE_WEIGHTS = { waterFit: 1, heatFit: 1, soilFit: 2, croppingIntensity: 2, stapleSecurity: 2 };

// Staple cereals for household food security in Bangladesh. Kept as a slug list here (not a database column) so
// no migration is needed and the offline and database repositories behave the same.
export const STAPLE_CEREAL_SLUGS = ['aman', 'boro', 'aus', 'wheat', 'maize'];

// Defaults for the optional filters in POST /api/evaluate "constraints".
//   requireStapleCereal: every alternative must contain a staple cereal (food for the household first).
//   onlyDocumentedPatterns: every alternative must be a subset of a cropping pattern reported in a BRRI/BARI survey or trial
//     (src/data/reference/croppingPatterns.json). Leaving a season fallow is always allowed.
export const CONSTRAINT_DEFAULTS = { requireStapleCereal: true, onlyDocumentedPatterns: true };

// Weight perturbations used by the ranking-stability check.
export const STABILITY = { downFactor: 0.5, upFactor: 2, upFloor: 1, stableShare: 0.8, moderateShare: 0.5 };

// Factors the brief names that this version does NOT model. Shown in every evaluate response so absence is never read as "good".
export const NOT_MODELED = [
  { id: 'erosion', en: 'Soil erosion and runoff', bn: 'মাটি ক্ষয় ও পানির প্রবাহ' },
  { id: 'organicMatter', en: 'Soil organic matter (only a legume and plant-family variety are used as a rough proxy)', bn: 'মাটির জৈব পদার্থ (শুধু ডালজাতীয় ফসল ও উদ্ভিদ পরিবারের বৈচিত্র্য মোটামুটি নির্দেশক হিসেবে ধরা হয়েছে)' },
  { id: 'forageValue', en: 'Fodder and forage value of crop residues', bn: 'গবাদিপশুর খাদ্য ও ফসলের অবশিষ্টাংশের মূল্য' },
  { id: 'marketSuitability', en: 'Prices, market access and income (cropping intensity is the only land-use proxy)', bn: 'দাম, বাজারের সুযোগ ও আয় (শুধু জমি ব্যবহারের হার ধরা হয়েছে)' },
  { id: 'pestCycles', en: 'Pest and disease cycles beyond plant-family variety', bn: 'পোকামাকড় ও রোগের চক্র (উদ্ভিদ পরিবারের বৈচিত্র্যের বাইরে)' },
  { id: 'seedLabourFlood', en: 'Seed supply, labour, and flood timing', bn: 'বীজের সরবরাহ, শ্রম ও বন্যার সময়' },
];

export const IRRIGATION_OPTIONS = ['none', 'limited', 'reliable'];
export const SALINITY_OPTIONS = ['none', 'slight', 'moderate', 'high'];
export const DRAINAGE_OPTIONS = ['good', 'moderate', 'poor'];

export const DISCLAIMER =
  'Field Shift is a decision-support tool. It explores options using climate data and simple, ' +
  'documented rules. It does not predict yield or profit and does not replace the judgment of ' +
  'the farmer or advice from local agricultural extension officers.';


// ---- Planting-window advisory (Phase 4). All HEURISTIC modelling choices, not NASA results. ----

// Growing degree days (GDD), modified method: each day's maximum is capped at capC and its
// minimum is raised to baseC, then GDD = max(0, (cappedMax + raisedMin) / 2 - baseC).
// 10 C base and 35 C cap are commonly used for rice but are NOT verified for any Bangladeshi variety.
export const GDD = { baseC: 10, capC: 35 };

// A cycle's GDD total is reported only if this share of its days has BOTH temperatures.
// Missing days add nothing to a sum, so a lower share would silently understate the total.
export const GDD_MIN_COVERAGE = 0.98;

// The early/late split year is fixed in advance (2001-2012 vs 2013-2025) so that nobody picks it
// after looking at the data.
export const PLANTING_SPLIT_YEAR = 2013;

// A shift is called "supported" only if at least this share of the alternative onset definitions
// (thresholds, window lengths, start dates) reach the same verdict as the main definition.
export const SHIFT_ROBUST_SHARE = 0.6;


// Which "usable rain onset" definition applies to which crop. Boro is irrigated and does not
// wait for the rains, so it remains explicitly outside this analysis and returns "not applicable".
// The other crops in the reference catalogue get a season-specific onset window so the advisory
// can be opened from any crop workflow.
// Aus is sown in April-May and depends on early rain, so its search starts on 1 May.
// Aman is transplanted in July-August after the monsoon arrives, so its search starts on 1 June.
// UNVERIFIED AGRONOMIC ASSUMPTIONS: they must be reviewed against BRRI/DAE guidance. Window length
// and threshold are the same heuristic as ONSET above.
export const ONSET_BY_CROP = {
  aus: { startMonth: 5, endMonth: 8, windowDays: 7, thresholdMm: 50 },
  aman: { startMonth: 6, endMonth: 8, windowDays: 7, thresholdMm: 50 },
  wheat: { startMonth: 11, endMonth: 3, windowDays: 7, thresholdMm: 50 },
  mustard: { startMonth: 11, endMonth: 2, windowDays: 7, thresholdMm: 50 },
  potato: { startMonth: 11, endMonth: 2, windowDays: 7, thresholdMm: 50 },
  lentil: { startMonth: 11, endMonth: 3, windowDays: 7, thresholdMm: 50 },
  maize: { startMonth: 11, endMonth: 4, windowDays: 7, thresholdMm: 50 },
  mungbean: { startMonth: 3, endMonth: 5, windowDays: 7, thresholdMm: 50 },
  jute: { startMonth: 4, endMonth: 8, windowDays: 7, thresholdMm: 50 },
  sesame: { startMonth: 3, endMonth: 6, windowDays: 7, thresholdMm: 50 },
  groundnut: { startMonth: 10, endMonth: 3, windowDays: 7, thresholdMm: 50 },
};

// If at least this share of the years in a period have their onset on the very first day the search
// allows, the true onset in those years may be earlier than anything the analysis can see.
export const BOUNDARY_SATURATED_SHARE = 0.5;
// Crops whose advisory is shown with an EXPERIMENTAL label (decision.experimental, warnings[], and an "EXPERIMENTAL." prefix on the SMS).
// Aus: its onset search starts in May, and a cross-check of stored NASA POWER May rainfall for Rajshahi against ERA5 reanalysis
// (not NASA data, not ground truth) did not corroborate the earlier-onset result (POWER May mean +81%, ERA5 +15%). See docs/SCIENTIFIC_METHOD.md.
export const EXPERIMENTAL_CROPS = {
  aus: {
    en: 'Experimental: for Aus the May rainfall in NASA POWER was not confirmed by an independent source (ERA5), so any change in when rain starts may partly reflect the data and not the weather. Use Aman for decisions.',
    bn: 'পরীক্ষামূলক: আউশের ক্ষেত্রে NASA POWER-এর মে মাসের বৃষ্টি স্বাধীন উৎস (ERA5) দিয়ে নিশ্চিত হয়নি, তাই বৃষ্টি শুরুর পরিবর্তন আংশিকভাবে আবহাওয়ার বদলে তথ্যের প্রভাব হতে পারে। সিদ্ধান্তের জন্য আমন দেখুন।',
  },
};

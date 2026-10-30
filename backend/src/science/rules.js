// Every tunable number of the scientific logic lives here, with its status.
// None of these are NASA results; they are modelling choices (heuristics) that a
// domain expert should review. docs/SCIENTIFIC_METHOD.md explains each one.

// A cropping window/year is used only if at least this share of its days has data.
export const MIN_COVERAGE = 0.9;

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
export const BASE_WEIGHTS = { waterFit: 1, heatFit: 1, soilFit: 2 };

export const IRRIGATION_OPTIONS = ['none', 'limited', 'reliable'];
export const SALINITY_OPTIONS = ['none', 'slight', 'moderate', 'high'];
export const DRAINAGE_OPTIONS = ['good', 'moderate', 'poor'];

export const DISCLAIMER =
  'Field Shift is a decision-support tool. It explores options using climate data and simple, ' +
  'documented rules. It does not predict yield or profit and does not replace the judgment of ' +
  'the farmer or advice from local agricultural extension officers.';

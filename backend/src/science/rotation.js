// Rotation engine: generates feasible crop sequences, scores them with transparent rules
// and explains the result. Pure functions only: no database, no HTTP, no clock.
//
// A "rotation" here is a set of 1-3 crops that fit into one 12-month cycle on the same plot
// (crops may overlap by at most one turnaround month). The score is a weighted average of
// components, each between 0 and 1. It is a HEURISTIC for comparing options, not a forecast
// of yield, profit or soil improvement.

import { monthsBetween, overlapMonths } from './calendar.js';
import { mean, round } from './stats.js';
import {
  BASE_WEIGHTS,
  HEAT_SCALE,
  IRRIGATION_ACCESS_FACTOR,
  WATER_SAVING_REFERENCE_MM,
  SALINITY_LEVEL,
  DRAINAGE_LEVEL,
  MAX_PAIR_OVERLAP_MONTHS,
  MIN_CROPS_ALTERNATIVE,
  MAX_CROPS,
  ALTERNATIVES_RETURNED,
  PRIORITIES,
  STAPLE_CEREAL_SLUGS,
  CONSTRAINT_DEFAULTS,
} from './rules.js';
import { patternInfo } from './cropPatterns.js';
import { rankingStability } from './rankingStability.js';

export const COMPONENT_LABELS = {
  waterFit: 'Rainfall covers water need',
  heatFit: 'Low heat-stress exposure',
  soilFit: 'Fits your soil conditions',
  waterSaving: 'Low irrigation requirement',
  soilHealth: 'Soil-health practices (legume, variety)',
  diversification: 'Crop variety (risk spreading proxy)',
  lowInput: 'Low input intensity',
  croppingIntensity: 'Plot kept in crop (cropping intensity)',
  stapleSecurity: 'Staple cereal for the household (up to two crops)',
};

export const stapleCount = (crops) => crops.filter((c) => STAPLE_CEREAL_SLUGS.includes(c.slug)).length;
export const hasStapleCereal = (crops) => stapleCount(crops) > 0;
const monthsInFieldOf = (crops) => new Set(crops.flatMap(cropMonthList)).size;

// Which farmer priority controls the weight of which component.
const PRIORITY_COMPONENT = {
  waterSaving: 'waterSaving',
  heatResilience: 'heatFit',
  soilHealth: 'soilHealth',
  diversification: 'diversification',
  lowInput: 'lowInput',
};

const metricCache = new WeakMap();

export function cropMonthList(crop) {
  return monthsBetween(crop.startMonth, crop.endMonth);
}

export function checkFeasible(crops) {
  for (let i = 0; i < crops.length; i += 1) {
    for (let j = i + 1; j < crops.length; j += 1) {
      const shared = overlapMonths(cropMonthList(crops[i]), cropMonthList(crops[j]));
      if (shared.length > MAX_PAIR_OVERLAP_MONTHS) {
        return {
          ok: false,
          reason: `${crops[i].nameEn} and ${crops[j].nameEn} would be in the field together for ${shared.length} months`,
        };
      }
    }
  }
  return { ok: true };
}

// All feasible sets of crops with minCrops..maxCrops members, in a stable order.
export function generateCandidates(crops, { minCrops = MIN_CROPS_ALTERNATIVE, maxCrops = MAX_CROPS } = {}) {
  const sorted = [...crops].sort((a, b) => a.slug.localeCompare(b.slug));
  const out = [];
  function extend(start, chosen) {
    if (chosen.length >= minCrops) out.push([...chosen]);
    if (chosen.length === maxCrops) return;
    for (let i = start; i < sorted.length; i += 1) {
      const next = [...chosen, sorted[i]];
      if (checkFeasible(next).ok) extend(i + 1, next);
    }
  }
  extend(0, []);
  return out;
}

// Which crops can share a year with which. checkFeasible only looks at PAIRS of crops, so a set is feasible exactly when
// every pair in it is feasible; one pairwise map is therefore enough for a picker to offer only eligible crops
// (the intersection of the chosen crops' lists). Returns { slug: [slugs that can be grown with it] }, sorted by slug.
export function compatibilityMap(crops) {
  const sorted = [...crops].sort((a, b) => a.slug.localeCompare(b.slug));
  const map = {};
  for (const a of sorted) {
    map[a.slug] = sorted.filter((b) => b.slug !== a.slug && checkFeasible([a, b]).ok).map((b) => b.slug);
  }
  return map;
}

export function rotationKey(crops) {
  return crops.map((c) => c.slug).sort().join('+');
}

// Order crops by start month counted from July (the Aman season), so labels read the way a
// farmer would say them: "Aman rice -> Mustard -> Mungbean".
export function orderForDisplay(crops) {
  return [...crops].sort((a, b) => ((a.startMonth + 5) % 12) - ((b.startMonth + 5) % 12));
}

function perCropMetrics(crop, ctx) {
  let contextMetrics = metricCache.get(ctx);
  if (!contextMetrics) {
    contextMetrics = new Map();
    metricCache.set(ctx, contextMetrics);
  }
  const cached = contextMetrics.get(crop);
  if (cached) return cached;

  const cc = ctx.cropClimate?.[crop.slug] ?? null;
  const need = (crop.waterNeedMmMin + crop.waterNeedMmMax) / 2;
  const access = IRRIGATION_ACCESS_FACTOR[ctx.irrigation];

  let waterFit = null;
  let irrigationNeedMm = null;
  if (cc && cc.rainMm !== null) {
    irrigationNeedMm = Math.max(0, need - cc.rainMm);
    const gapShare = irrigationNeedMm / need;
    waterFit = 1 - gapShare * access;
  }

  let heatFit = null;
  if (cc && cc.heatFraction !== null) {
    heatFit = 1 - Math.min(1, cc.heatFraction * (crop.heatSensitivity / 5) * HEAT_SCALE);
  }

  // A soil value that was not entered is not scored (null), never assumed to be good.
  const salinityIn = ctx.soil?.salinity ?? null;
  const drainageIn = ctx.soil?.drainage ?? null;
  const salinityPenalty = salinityIn === null ? null : Math.max(0, SALINITY_LEVEL[salinityIn] - crop.salinityTolerance) / 3;
  const drainagePenalty = drainageIn === null ? null : Math.max(0, DRAINAGE_LEVEL[drainageIn] - crop.waterloggingTolerance) / 3;
  const soilFit = salinityPenalty === null && drainagePenalty === null ? null : 1 - Math.min(1, (salinityPenalty ?? 0) + (drainagePenalty ?? 0));

  const metrics = {
    slug: crop.slug,
    needMm: need,
    rainMm: cc?.rainMm ?? null,
    rainYears: cc?.rainYears ?? 0,
    heatFraction: cc?.heatFraction ?? null,
    heatYears: cc?.heatYears ?? 0,
    irrigationNeedMm,
    waterFit,
    heatFit,
    soilFit,
    salinityPenalty,
    drainagePenalty,
  };
  contextMetrics.set(crop, metrics);
  return metrics;
}

function meanOrNull(values) {
  return mean(values.filter((v) => v !== null));
}

// The weight of every component for this request. ctx.weightOverrides ({ id: weight }) replaces some of them; it is used only
// by the ranking-stability check, never by a request.
export function effectiveWeights(ctx) {
  const w = {
    waterFit: BASE_WEIGHTS.waterFit,
    heatFit: BASE_WEIGHTS.heatFit + (ctx.priorities.heatResilience ?? 0),
    soilFit: BASE_WEIGHTS.soilFit,
    waterSaving: ctx.priorities.waterSaving ?? 0,
    soilHealth: ctx.priorities.soilHealth ?? 0,
    diversification: ctx.priorities.diversification ?? 0,
    lowInput: ctx.priorities.lowInput ?? 0,
    croppingIntensity: BASE_WEIGHTS.croppingIntensity,
    stapleSecurity: BASE_WEIGHTS.stapleSecurity,
  };
  return ctx.weightOverrides ? { ...w, ...ctx.weightOverrides } : w;
}

// Score one rotation. Returns components (value 0-1 or null when it cannot be computed),
// the weights used, and the overall 0-100 score.
export function scoreRotation(crops, ctx) {
  const metrics = crops.map((c) => perCropMetrics(c, ctx));
  const families = new Set(crops.map((c) => c.family));
  const legumes = crops.filter((c) => c.isLegume);

  const familyVariety = crops.length > 1 ? (families.size - 1) / (crops.length - 1) : 0;
  const values = {
    waterFit: meanOrNull(metrics.map((m) => m.waterFit)),
    heatFit: meanOrNull(metrics.map((m) => m.heatFit)),
    soilFit: meanOrNull(metrics.map((m) => m.soilFit)),
    waterSaving: null,
    soilHealth: 0.5 * (legumes.length > 0 ? 1 : 0) + 0.5 * familyVariety,
    diversification: Math.min(1, crops.length / 3),
    lowInput: 1 - (mean(crops.map((c) => c.inputIntensity)) - 1) / 4,
    croppingIntensity: monthsInFieldOf(crops) / 12,
    stapleSecurity: Math.min(1, stapleCount(crops) / 2),
  };
  const irrigationVolumes = metrics.map((m) => m.irrigationNeedMm);
  const totalIrrigationMm = irrigationVolumes.every((v) => v !== null)
    ? irrigationVolumes.reduce((a, b) => a + b, 0)
    : null;
  if (totalIrrigationMm !== null) {
    values.waterSaving = 1 - Math.min(1, totalIrrigationMm / WATER_SAVING_REFERENCE_MM);
  }

  const weights = effectiveWeights(ctx);

  let num = 0;
  let den = 0;
  const components = Object.keys(values).map((id) => {
    const value = values[id];
    const weight = weights[id];
    if (value !== null && weight > 0) {
      num += value * weight;
      den += weight;
    }
    return { id, label: COMPONENT_LABELS[id], value: value === null ? null : round(value, 3), weight };
  });

  return {
    score: den > 0 ? round((num / den) * 100, 1) : null,
    components,
    metrics,
    totalIrrigationMm: totalIrrigationMm === null ? null : round(totalIrrigationMm, 0),
  };
}

function names(crops) {
  return crops.map((c) => c.nameEn).join(', ');
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

// Turn component values into plain sentences. "strong" -> benefit, "weak" -> risk.
function narrate(crops, scored, ctx, monthsInField) {
  const val = Object.fromEntries(scored.components.map((c) => [c.id, c.value]));
  const benefits = [];
  const risks = [];
  const benefitsBn = [];
  const risksBn = [];
  const addBenefit = (en, bn) => { benefits.push(en); benefitsBn.push(bn); };
  const addRisk = (en, bn) => { risks.push(en); risksBn.push(bn); };
  if (monthsInField <= 7) {
    addRisk(
      `The plot is in crop for only about ${monthsInField} months of the year, so much of the year is left unused. The score counts this as lower cropping intensity, but income is not estimated.`,
      `বছরের মাত্র প্রায় ${monthsInField} মাস জমিতে ফসল থাকে, তাই বছরের বড় অংশ জমি অব্যবহৃত থাকে। স্কোরে এটিকে কম শস্য-নিবিড়তা হিসেবে ধরা হয়েছে, তবে আয়ের হিসাব করা হয়নি।`,
    );
  } else if (monthsInField >= 10) {
    addBenefit(
      `The plot is in crop for about ${monthsInField} months of the year (high cropping intensity).`,
      `বছরের প্রায় ${monthsInField} মাস জমিতে ফসল থাকে (উচ্চ শস্য-নিবিড়তা)।`,
    );
  }
  if (!hasStapleCereal(crops)) addRisk(
    'No staple cereal (rice, wheat or maize) is included, so the household would have to buy its main food or rely on other plots.',
    'প্রধান খাদ্যশস্য (ধান, গম বা ভুট্টা) নেই, তাই পরিবারের প্রধান খাদ্য কিনতে হবে বা অন্য জমির ওপর নির্ভর করতে হবে.',
  );
  const hotCrops = scored.metrics
    .map((m, i) => ({ m, crop: crops[i] }))
    .filter(({ m }) => m.heatFit !== null && m.heatFit < 0.6)
    .map(({ crop }) => crop.nameEn);
  const poorSoil = scored.metrics
    .map((m, i) => ({ m, crop: crops[i] }))
    .filter(({ m }) => m.soilFit !== null && m.soilFit < 0.6)
    .map(({ crop }) => crop.nameEn);

  if (val.waterFit !== null) {
    if (val.waterFit >= 0.7) addBenefit(
      'Rainfall during the growing months covers much of the approximate water need, so there is less reliance on irrigation.',
      'চাষের মাসগুলোর বৃষ্টি আনুমানিক পানির চাহিদার বড় অংশ পূরণ করে, তাই সেচের ওপর নির্ভরতা কম।',
    );
    else if (val.waterFit <= 0.45) addRisk(
      'Rainfall during the growing months covers little of the approximate water need; this rotation depends on irrigation being available when needed.',
      'চাষের মাসগুলোর বৃষ্টি আনুমানিক পানির চাহিদার সামান্য অংশ পূরণ করে; প্রয়োজনের সময় সেচ পাওয়া এই পর্যায়ের জন্য গুরুত্বপূর্ণ।',
    );
  }
  if (val.waterSaving !== null && scored.totalIrrigationMm !== null) {
    if (val.waterSaving >= 0.65) addBenefit(
      `Estimated extra irrigation need is modest (about ${scored.totalIrrigationMm} mm across the year, a rough heuristic estimate).`,
      `বছরে অতিরিক্ত সেচের আনুমানিক প্রয়োজন কম (প্রায় ${scored.totalIrrigationMm} মিমি; এটি একটি মোটামুটি অনুমান)।`,
    );
    else if (val.waterSaving <= 0.35) addRisk(
      `Estimated extra irrigation need is high (about ${scored.totalIrrigationMm} mm across the year, a rough heuristic estimate).`,
      `বছরে অতিরিক্ত সেচের আনুমানিক প্রয়োজন বেশি (প্রায় ${scored.totalIrrigationMm} মিমি; এটি একটি মোটামুটি অনুমান)।`,
    );
  }
  if (val.heatFit !== null) {
    if (val.heatFit >= 0.75) addBenefit(
      'Few days in the growing months reach the heat-stress thresholds used for these crops.',
      'চাষের মাসগুলোতে অল্প কয়েক দিন এই ফসলগুলোর ব্যবহৃত তাপ-চাপের সীমায় পৌঁছায়।',
    );
    else if (val.heatFit <= 0.55) addRisk(
      `A notable share of growing-season days reach the heat-stress threshold${hotCrops.length ? ` (${hotCrops.join(', ')})` : ''}.`,
      `চাষের সময়ের উল্লেখযোগ্য সংখ্যক দিন তাপ-চাপের সীমায় পৌঁছায়${hotCrops.length ? ` (${hotCrops.join(', ')})` : ''}।`,
    );
  }
  if (val.soilFit !== null && val.soilFit >= 0.85) addBenefit(
    'The crops match the soil salinity and drainage you entered.',
    'আপনার দেওয়া মাটির লবণাক্ততা ও পানি নিষ্কাশনের তথ্যের সঙ্গে ফসলগুলো মানানসই।',
  );
  if (poorSoil.length) addRisk(
    `${poorSoil.join(', ')} ${poorSoil.length > 1 ? 'are' : 'is'} poorly matched to the soil salinity or drainage you entered.`,
    `${poorSoil.join(', ')} আপনার দেওয়া মাটির লবণাক্ততা বা পানি নিষ্কাশনের তথ্যের সঙ্গে ভালোভাবে মানানসই নয়।`,
  );

  const legumes = crops.filter((c) => c.isLegume);
  if (legumes.length) {
    addBenefit(
      `Includes a legume (${names(legumes)}) and, in general agronomy, legumes and a mix of plant families support nutrient cycling and reduce carry-over pests. The size of any effect is not estimated here.`,
      `ডালজাতীয় ফসল (${legumes.map((c) => c.nameBn).join(', ')}) আছে। সাধারণ কৃষিবিজ্ঞানে ডালজাতীয় ফসল ও বিভিন্ন উদ্ভিদ-পরিবারের মিশ্রণ পুষ্টির চক্রে সহায়তা করে এবং অবশিষ্ট পোকামাকড়ের ঝুঁকি কমাতে পারে। প্রভাবের মাত্রা এখানে হিসাব করা হয়নি।`,
    );
  } else if (crops.length > 1 && new Set(crops.map((c) => c.family)).size === 1) {
    addRisk(
      'All crops are from the same plant family and none is a legume, so the usual soil-health benefits of rotation are limited.',
      'সব ফসল একই উদ্ভিদ-পরিবারের এবং কোনোটি ডালজাতীয় নয়, তাই পর্যায়ক্রমিক চাষের সাধারণ মাটি-স্বাস্থ্য সুবিধা সীমিত।',
    );
  } else if (!legumes.length) {
    addRisk('No legume in the rotation.', 'এই শস্য পর্যায়ে কোনো ডালজাতীয় ফসল নেই।');
  }
  if (crops.length >= 3) addBenefit(
    'Three different crops spread weather and market risk across seasons (a proxy only; profit is not estimated).',
    'তিনটি ভিন্ন ফসল মৌসুমজুড়ে আবহাওয়া ও বাজারের ঝুঁকি ভাগ করে (এটি শুধু একটি আনুমানিক নির্দেশক; লাভের হিসাব করা হয়নি)।',
  );
  if (crops.length === 1) addRisk(
    'A single crop leaves the plot without rotation benefits and puts all risk on one crop.',
    'একটি ফসল থাকলে পর্যায়ক্রমিক চাষের সুবিধা পাওয়া যায় না এবং সব ঝুঁকি একটি ফসলের ওপর থাকে।',
  );
  if (val.lowInput >= 0.7) addBenefit(
    'Mostly low-input crops (less fertiliser, irrigation and labour).',
    'বেশিরভাগ ফসলের জন্য কম উপকরণ লাগে (সার, সেচ ও শ্রম কম)।',
  );
  else if (val.lowInput <= 0.4) addRisk(
    'Relies on high-input crops (fertiliser, irrigation and labour), which raises cost and workload.',
    'বেশি উপকরণ-নির্ভর ফসল (সার, সেচ ও শ্রম) থাকায় খরচ ও কাজের চাপ বাড়ে।',
  );

  const gaps = [];
  const gapsBn = [];
  if (scored.metrics.every((m) => m.rainMm === null)) {
    gaps.push('No climate data is loaded for this district, so the rainfall (water) and heat components were left out of the score instead of being guessed.');
    gapsBn.push('এই জেলার কোনো জলবায়ু তথ্য লোড হয়নি, তাই অনুমান না করে বৃষ্টি (পানি) ও তাপের উপাদান স্কোর থেকে বাদ দেওয়া হয়েছে।');
  } else {
    const short = scored.metrics.filter((m) => m.rainMm !== null && m.rainYears < 15);
    if (short.length) {
      gaps.push(`Only a few years of usable data cover the growing months of ${short.map((m) => m.slug).join(', ')}, so averages are less reliable.`);
      gapsBn.push(`${short.map((m) => m.slug).join(', ')}-এর চাষের মাসগুলোতে অল্প কয়েক বছরের ব্যবহারযোগ্য তথ্য আছে, তাই গড়ের নির্ভরযোগ্যতা কম।`);
    }
  }
  gaps.push('Crop traits (water need, heat threshold, tolerances, typical months) are general-knowledge assumptions that have not been verified against BRRI, BARI or FAO tables.');
  gapsBn.push('ফসলের বৈশিষ্ট্য (পানির চাহিদা, তাপের সীমা, সহনশীলতা ও সাধারণ চাষের মাস) সাধারণ জ্ঞানের অনুমান; BRRI, BARI বা FAO-এর সারণির সঙ্গে যাচাই করা হয়নি।');
  gaps.push('Climate values describe a grid cell of roughly 0.5 degrees, not your field. Local rain, soil and canal/pump access can differ.');
  gapsBn.push('জলবায়ুর মান প্রায় ০.৫ ডিগ্রির একটি গ্রিড সেলের তথ্য, আপনার জমির সরাসরি তথ্য নয়। স্থানীয় বৃষ্টি, মাটি এবং খাল বা পাম্পের সুবিধা ভিন্ন হতে পারে।');
  const soilIn = { salinity: ctx.soil?.salinity ?? null, drainage: ctx.soil?.drainage ?? null };
  const missingSoil = Object.entries(soilIn).filter(([, v]) => v === null).map(([k]) => k);
  if (missingSoil.length === 2) {
    gaps.push('No soil salinity or drainage was entered, so the soil match was left out of the score. It was not assumed to be good.');
    gapsBn.push('মাটির লবণাক্ততা বা পানি নিষ্কাশনের কোনো তথ্য দেওয়া হয়নি, তাই মাটির সামঞ্জস্য স্কোর থেকে বাদ দেওয়া হয়েছে। এটিকে ভালো ধরে নেওয়া হয়নি।');
  } else {
    gaps.push(`Soil information is only what you entered (salinity: ${soilIn.salinity ?? 'not entered'}, drainage: ${soilIn.drainage ?? 'not entered'}); no soil survey data is used.${missingSoil.length ? ` The ${missingSoil[0]} match was left out of the score because it was not entered.` : ''}`);
    gapsBn.push(`মাটির তথ্য শুধু আপনার দেওয়া তথ্যের ওপর ভিত্তি করে (লবণাক্ততা: ${soilIn.salinity ?? 'দেওয়া হয়নি'}, পানি নিষ্কাশন: ${soilIn.drainage ?? 'দেওয়া হয়নি'}); কোনো মাটি জরিপের তথ্য ব্যবহার করা হয়নি${missingSoil.length ? `। ${missingSoil[0]}-এর সামঞ্জস্য তথ্য না থাকায় স্কোর থেকে বাদ দেওয়া হয়েছে।` : '।'}`);
  }
  gaps.push('Seed availability, prices, labour, pests, diseases and flood timing are not modelled.');
  gapsBn.push('বীজের প্রাপ্যতা, দাম, শ্রম, পোকামাকড়, রোগ এবং বন্যার সময় মডেলে অন্তর্ভুক্ত নয়।');
  gaps.push('Typical month windows are used; real sowing and harvest dates vary with variety and the season.');
  gapsBn.push('সাধারণ মাসের সময়সীমা ব্যবহার করা হয়েছে; জাত ও মৌসুম অনুযায়ী প্রকৃত বপন ও কাটার তারিখ ভিন্ন হতে পারে।');
  return { benefits, risks, benefitsBn, risksBn, gaps, gapsBn };
}

function evidenceFor(crops, scored) {
  return crops.map((crop, i) => {
    const m = scored.metrics[i];
    return {
      crop: crop.nameEn,
      cropBn: crop.nameBn,
      months: cropMonthList(crop),
      assumedWaterNeedMm: [crop.waterNeedMmMin, crop.waterNeedMmMax],
      meanRainDuringCropMm: m.rainMm,
      rainYearsUsed: m.rainYears,
      heatThresholdC: crop.heatThresholdC,
      shareOfDaysAtOrAboveThreshold: m.heatFraction,
      heatYearsUsed: m.heatYears,
      cropParameterBasis: crop.basis,
      cropTraitSources: crop.traitSources ?? null,
    };
  });
}

function buildStrategy({ crops, kind, ctx }) {
  const scored = scoreRotation(crops, ctx);
  const ordered = orderForDisplay(crops);
  const months = new Set(crops.flatMap(cropMonthList));
  const text = narrate(ordered, scored, ctx, months.size);
  return {
    id: rotationKey(crops),
    kind,
    label: ordered.map((c) => c.nameEn).join(' → '),
    labelBn: ordered.map((c) => c.nameBn).join(' → '),
    crops: ordered.map((c) => ({ slug: c.slug, nameEn: c.nameEn, nameBn: c.nameBn, months: cropMonthList(c) })),
    monthsInField: months.size,
    hasStapleCereal: hasStapleCereal(crops),
    pattern: patternInfo(crops.map((c) => c.slug)),
    score: scored.score,
    components: scored.components,
    totalIrrigationMm: scored.totalIrrigationMm,
    benefits: text.benefits,
    risks: text.risks,
    benefitsBn: text.benefitsBn,
    risksBn: text.risksBn,
    informationGaps: text.gaps,
    informationGapsBn: text.gapsBn,
    evidence: evidenceFor(ordered, scored),
  };
}

function priorityNote(key, priorities) {
  const p = PRIORITIES.find((x) => x.key === key);
  const level = priorities[key];
  return p && level > 0 ? ` (you rated "${p.labelEn}" ${level}/3)` : '';
}

function compare(strategy, existing, priorities) {
  if (strategy.kind === 'existing') return null;
  const deltas = strategy.components
    .map((c) => {
      const base = existing.components.find((e) => e.id === c.id);
      if (c.value === null || base.value === null || c.weight === 0) return null;
      return { id: c.id, label: c.label, delta: round(c.value - base.value, 3), weight: c.weight };
    })
    .filter(Boolean);
  const keyFor = (id) => Object.entries(PRIORITY_COMPONENT).find(([, v]) => v === id)?.[0];
  const ups = deltas.filter((d) => d.delta >= 0.05).sort((a, b) => b.delta * b.weight - a.delta * a.weight).slice(0, 3);
  const downs = deltas.filter((d) => d.delta <= -0.05).sort((a, b) => a.delta * a.weight - b.delta * b.weight).slice(0, 3);
  const diff = existing.score === null || strategy.score === null ? null : round(strategy.score - existing.score, 1);
  const explain = (d) => `${d.label}: ${d.delta > 0 ? '+' : ''}${Math.round(d.delta * 100)} points${keyFor(d.id) ? priorityNote(keyFor(d.id), priorities) : ''}`;
  const tradeOffs = downs.map(explain);
  // Cropping intensity is in the score; the plain-month comparison is repeated here because it is easy to overlook.
  if (strategy.monthsInField <= existing.monthsInField - 2 && !tradeOffs.some((t) => t.startsWith(COMPONENT_LABELS.croppingIntensity))) {
    tradeOffs.push(`Uses the plot for about ${strategy.monthsInField} months a year instead of ${existing.monthsInField} (lower cropping intensity)`);
  }
  return {
    scoreDifference: diff,
    monthsInField: { existing: existing.monthsInField, thisRotation: strategy.monthsInField },
    improvements: ups.map(explain),
    tradeOffs,
  };
}

// Main entry point.
//   crops            all available crops
//   existingSlugs    the farmer's current rotation
//   ctx              { cropClimate, soil, irrigation, priorities }
//   constraints      { requireStapleCereal, onlyDocumentedPatterns } (defaults: both true; see CONSTRAINT_DEFAULTS)
// The current rotation is always scored and shown, even when it fails a constraint; constraints only limit the alternatives.
export function evaluateRotations({ crops, existingSlugs, ctx, constraints = {} }) {
  const applied = { ...CONSTRAINT_DEFAULTS, ...constraints };
  const bySlug = new Map(crops.map((c) => [c.slug, c]));
  const existingCrops = existingSlugs.map((s) => bySlug.get(s));
  const existing = buildStrategy({ crops: existingCrops, kind: 'existing', ctx });

  const existingKey = rotationKey(existingCrops);
  const all = generateCandidates(crops).filter((set) => rotationKey(set) !== existingKey);
  const excluded = { noStapleCereal: 0, notDocumented: 0 };
  const candidates = all.filter((set) => {
    if (applied.requireStapleCereal && !hasStapleCereal(set)) { excluded.noStapleCereal += 1; return false; }
    if (applied.onlyDocumentedPatterns && !patternInfo(set.map((c) => c.slug)).documented) { excluded.notDocumented += 1; return false; }
    return true;
  });
  const byScore = (a, b) => b.score - a.score || a.id.localeCompare(b.id);
  const scored = candidates
    .map((set) => buildStrategy({ crops: set, kind: 'alternative', ctx }))
    .filter((s) => s.score !== null)
    .sort(byScore);

  const alternatives = scored.slice(0, ALTERNATIVES_RETURNED).map((s, i) => ({ ...s, rank: i + 1 }));
  const beating = scored.filter((s) => existing.score !== null && s.score > existing.score).length;

  // Same candidates, re-ranked under changed weights (scores only; no explanations are built).
  const rankUnder = (overrides) => candidates
    .map((set) => ({ id: rotationKey(set), score: scoreRotation(set, { ...ctx, weightOverrides: overrides }).score }))
    .filter((r) => r.score !== null)
    .sort(byScore)
    .map((r) => r.id);
  const stability = rankingStability({ baseOrder: scored.map((s) => s.id), effectiveWeights: effectiveWeights(ctx), rank: rankUnder });

  existing.rank = null;
  existing.comparison = null;
  existing.summary =
    existing.score === null
      ? 'The current rotation could not be scored.'
      : `Your current rotation scores ${existing.score} out of 100 on these heuristic rules; ${beating} of ${scored.length} alternative rotations that pass the filters scored higher.`;
  if (existing.score !== null && scored.length > 0 && beating >= scored.length / 2 && existing.pattern.documented) {
    existing.summary += ` Your rotation is itself a documented pattern (${existing.pattern.matches.map((m) => m.label).join('; ')}). A low rank here mostly reflects its higher water, heat and input use: yield, food output and income are not modelled, so it does not mean your system is wrong.`;
  }
  for (const alt of alternatives) {
    alt.comparison = compare(alt, existing, ctx.priorities);
    const d = alt.comparison.scoreDifference;
    alt.summary =
      `Ranked #${alt.rank} of ${scored.length} alternatives that pass the filters, scoring ${alt.score}` +
      (d === null ? '.' : ` (${d >= 0 ? '+' : ''}${d} compared with your current rotation).`);
  }

  return {
    strategies: [existing, ...alternatives],
    alternativesConsidered: scored.length,
    constraints: {
      applied,
      candidatesBeforeFilters: all.length,
      excluded,
      note: 'Filters limit the ALTERNATIVES only. Your current rotation is always scored. "Documented" means reported in a BRRI/BARI survey or trial, not recommended for your farm.',
    },
    stability,
  };
}

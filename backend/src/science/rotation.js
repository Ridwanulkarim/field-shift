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
} from './rules.js';

export const COMPONENT_LABELS = {
  waterFit: 'Rainfall covers water need',
  heatFit: 'Low heat-stress exposure',
  soilFit: 'Fits your soil conditions',
  waterSaving: 'Low irrigation requirement',
  soilHealth: 'Soil-health practices (legume, variety)',
  diversification: 'Crop variety (risk spreading proxy)',
  lowInput: 'Low input intensity',
};

// Which farmer priority controls the weight of which component.
const PRIORITY_COMPONENT = {
  waterSaving: 'waterSaving',
  heatResilience: 'heatFit',
  soilHealth: 'soilHealth',
  diversification: 'diversification',
  lowInput: 'lowInput',
};

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

export function rotationKey(crops) {
  return crops.map((c) => c.slug).sort().join('+');
}

// Order crops by start month counted from July (the Aman season), so labels read the way a
// farmer would say them: "Aman rice -> Mustard -> Mungbean".
export function orderForDisplay(crops) {
  return [...crops].sort((a, b) => ((a.startMonth + 5) % 12) - ((b.startMonth + 5) % 12));
}

function perCropMetrics(crop, ctx) {
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

  const salinityPenalty = Math.max(0, SALINITY_LEVEL[ctx.soil.salinity] - crop.salinityTolerance) / 3;
  const drainagePenalty = Math.max(0, DRAINAGE_LEVEL[ctx.soil.drainage] - crop.waterloggingTolerance) / 3;
  const soilFit = 1 - Math.min(1, salinityPenalty + drainagePenalty);

  return {
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
}

function meanOrNull(values) {
  return mean(values.filter((v) => v !== null));
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
    soilFit: mean(metrics.map((m) => m.soilFit)),
    waterSaving: null,
    soilHealth: 0.5 * (legumes.length > 0 ? 1 : 0) + 0.5 * familyVariety,
    diversification: Math.min(1, crops.length / 3),
    lowInput: 1 - (mean(crops.map((c) => c.inputIntensity)) - 1) / 4,
  };
  const irrigationVolumes = metrics.map((m) => m.irrigationNeedMm);
  const totalIrrigationMm = irrigationVolumes.every((v) => v !== null)
    ? irrigationVolumes.reduce((a, b) => a + b, 0)
    : null;
  if (totalIrrigationMm !== null) {
    values.waterSaving = 1 - Math.min(1, totalIrrigationMm / WATER_SAVING_REFERENCE_MM);
  }

  const weights = {
    waterFit: BASE_WEIGHTS.waterFit,
    heatFit: BASE_WEIGHTS.heatFit + (ctx.priorities.heatResilience ?? 0),
    soilFit: BASE_WEIGHTS.soilFit,
    waterSaving: ctx.priorities.waterSaving ?? 0,
    soilHealth: ctx.priorities.soilHealth ?? 0,
    diversification: ctx.priorities.diversification ?? 0,
    lowInput: ctx.priorities.lowInput ?? 0,
  };

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
  if (monthsInField <= 7) {
    risks.push(`The plot is in crop for only about ${monthsInField} months of the year, so a lot of the year is left unused. The score does not reward using more months, so check this against your goals.`);
  }
  const hotCrops = scored.metrics
    .map((m, i) => ({ m, crop: crops[i] }))
    .filter(({ m }) => m.heatFit !== null && m.heatFit < 0.6)
    .map(({ crop }) => crop.nameEn);
  const poorSoil = scored.metrics
    .map((m, i) => ({ m, crop: crops[i] }))
    .filter(({ m }) => m.soilFit < 0.6)
    .map(({ crop }) => crop.nameEn);

  if (val.waterFit !== null) {
    if (val.waterFit >= 0.7) benefits.push('Rainfall during the growing months covers much of the approximate water need, so there is less reliance on irrigation.');
    else if (val.waterFit <= 0.45) risks.push('Rainfall during the growing months covers little of the approximate water need; this rotation depends on irrigation being available when needed.');
  }
  if (val.waterSaving !== null && scored.totalIrrigationMm !== null) {
    if (val.waterSaving >= 0.65) benefits.push(`Estimated extra irrigation need is modest (about ${scored.totalIrrigationMm} mm across the year, a rough heuristic estimate).`);
    else if (val.waterSaving <= 0.35) risks.push(`Estimated extra irrigation need is high (about ${scored.totalIrrigationMm} mm across the year, a rough heuristic estimate).`);
  }
  if (val.heatFit !== null) {
    if (val.heatFit >= 0.75) benefits.push('Few days in the growing months reach the heat-stress thresholds used for these crops.');
    else if (val.heatFit <= 0.55) risks.push(`A notable share of growing-season days reach the heat-stress threshold${hotCrops.length ? ` (${hotCrops.join(', ')})` : ''}.`);
  }
  if (val.soilFit >= 0.85) benefits.push('The crops match the soil salinity and drainage you entered.');
  if (poorSoil.length) risks.push(`${poorSoil.join(', ')} ${poorSoil.length > 1 ? 'are' : 'is'} poorly matched to the soil salinity or drainage you entered.`);

  const legumes = crops.filter((c) => c.isLegume);
  if (legumes.length) {
    benefits.push(`Includes a legume (${names(legumes)}) and, in general agronomy, legumes and a mix of plant families support nutrient cycling and reduce carry-over pests. The size of any effect is not estimated here.`);
  } else if (crops.length > 1 && new Set(crops.map((c) => c.family)).size === 1) {
    risks.push('All crops are from the same plant family and none is a legume, so the usual soil-health benefits of rotation are limited.');
  } else if (!legumes.length) {
    risks.push('No legume in the rotation.');
  }
  if (crops.length >= 3) benefits.push('Three different crops spread weather and market risk across seasons (a proxy only; profit is not estimated).');
  if (crops.length === 1) risks.push('A single crop leaves the plot without rotation benefits and puts all risk on one crop.');
  if (val.lowInput >= 0.7) benefits.push('Mostly low-input crops (less fertiliser, irrigation and labour).');
  else if (val.lowInput <= 0.4) risks.push('Relies on high-input crops (fertiliser, irrigation and labour), which raises cost and workload.');

  const gaps = [];
  if (scored.metrics.every((m) => m.rainMm === null)) {
    gaps.push('No climate data is loaded for this district, so the rainfall (water) and heat components were left out of the score instead of being guessed.');
  } else {
    const short = scored.metrics.filter((m) => m.rainMm !== null && m.rainYears < 15);
    if (short.length) gaps.push(`Only a few years of usable data cover the growing months of ${short.map((m) => m.slug).join(', ')}, so averages are less reliable.`);
  }
  gaps.push('Crop traits (water need, heat threshold, tolerances, typical months) are general-knowledge assumptions that have not been verified against BRRI, BARI or FAO tables.');
  gaps.push('Climate values describe a grid cell of roughly 0.5 degrees, not your field. Local rain, soil and canal/pump access can differ.');
  gaps.push(`Soil information is only what you entered (salinity: ${ctx.soil.salinity}, drainage: ${ctx.soil.drainage}); no soil survey data is used.`);
  gaps.push('Seed availability, prices, labour, pests, diseases and flood timing are not modelled.');
  gaps.push('Typical month windows are used; real sowing and harvest dates vary with variety and the season.');
  return { benefits, risks, gaps };
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
    score: scored.score,
    components: scored.components,
    totalIrrigationMm: scored.totalIrrigationMm,
    benefits: text.benefits,
    risks: text.risks,
    informationGaps: text.gaps,
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
  // The score deliberately ignores how many months the plot is cropped (that would imply an
  // income claim), so a drop in cropping intensity is stated here instead.
  if (strategy.monthsInField <= existing.monthsInField - 2) {
    tradeOffs.push(
      `Uses the plot for about ${strategy.monthsInField} months a year instead of ${existing.monthsInField} (lower cropping intensity; not part of the score)`,
    );
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
export function evaluateRotations({ crops, existingSlugs, ctx }) {
  const bySlug = new Map(crops.map((c) => [c.slug, c]));
  const existingCrops = existingSlugs.map((s) => bySlug.get(s));
  const existing = buildStrategy({ crops: existingCrops, kind: 'existing', ctx });

  const existingKey = rotationKey(existingCrops);
  const candidates = generateCandidates(crops).filter((set) => rotationKey(set) !== existingKey);
  const scored = candidates
    .map((set) => buildStrategy({ crops: set, kind: 'alternative', ctx }))
    .filter((s) => s.score !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const alternatives = scored.slice(0, ALTERNATIVES_RETURNED).map((s, i) => ({ ...s, rank: i + 1 }));
  const beating = scored.filter((s) => existing.score !== null && s.score > existing.score).length;

  existing.rank = null;
  existing.comparison = null;
  existing.summary =
    existing.score === null
      ? 'The current rotation could not be scored.'
      : `Your current rotation scores ${existing.score} out of 100 on these heuristic rules; ${beating} of ${scored.length} alternative rotations that fit one year scored higher.`;
  for (const alt of alternatives) {
    alt.comparison = compare(alt, existing, ctx.priorities);
    const d = alt.comparison.scoreDifference;
    alt.summary =
      `Ranked #${alt.rank} of ${scored.length} feasible alternatives, scoring ${alt.score}` +
      (d === null ? '.' : ` (${d >= 0 ? '+' : ''}${d} compared with your current rotation).`);
  }

  return {
    strategies: [existing, ...alternatives],
    alternativesConsidered: scored.length,
  };
}

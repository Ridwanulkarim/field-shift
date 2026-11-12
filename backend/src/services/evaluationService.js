// Application logic: loads data through the repository, runs the science, shapes the response.
// No HTTP and no SQL in here.

import { cropClimate, climateIndicators, seriesCoverage } from '../science/climate.js';
import { evaluateRotations, checkFeasible, compatibilityMap } from '../science/rotation.js';
import { plantingWindowAnalysis } from '../science/plantingWindow.js';
import { buildAdvisory } from '../science/plantingAdvisory.js';
import { buildFarmerAdvisory } from '../science/farmerAdvisory.js';
import { notFound, validationError } from '../utils/errors.js';
import { boundedSet } from '../utils/boundedCache.js';
import { salinityClassFromDsM as salinityFromDsM } from '../science/soil.js';
import { freshnessFor, makeDataLabel } from '../utils/dataLabel.js';
import { locateField } from '../geo/fieldLocation.js';
import {
  BASE_WEIGHTS,
  DISCLAIMER,
  HEAT_SCALE,
  ONSET,
  PREMONSOON_HEAT_C,
  PRIORITIES,
  PRIORITY_MIN,
  PRIORITY_MAX,
  MIN_COVERAGE,
  IRRIGATION_ACCESS_FACTOR,
  PLANTING_SPLIT_YEAR,
  NOT_MODELED,
  MAX_CROPS,
  MAX_PAIR_OVERLAP_MONTHS,
} from '../science/rules.js';

export const METHOD = {
  summary:
    'Every feasible rotation of 2-3 crops that fits in one year is scored from 0 to 100 as a weighted average of simple components. ' +
    'The score is a heuristic for comparing options, not a forecast of yield, profit or soil improvement.',
  components: [
    { id: 'waterFit', weight: `${BASE_WEIGHTS.waterFit} (fixed)`, description: 'Share of each crop\'s approximate water need that rainfall during its months covers, softened by your irrigation access.' },
    { id: 'heatFit', weight: `${BASE_WEIGHTS.heatFit} + your heat priority`, description: 'Share of days in each crop\'s months at or above its heat-stress threshold, scaled by how heat-sensitive the crop is.' },
    { id: 'soilFit', weight: `${BASE_WEIGHTS.soilFit} (fixed)`, description: 'Match between the soil salinity and drainage you entered and each crop\'s tolerance. Left out of the score (never assumed good) when neither was entered.' },
    { id: 'waterSaving', weight: 'your water priority', description: 'Estimated extra irrigation volume (needs minus rain) summed over the crops; less is better.' },
    { id: 'soilHealth', weight: 'your soil priority', description: 'Half for including a legume, half for variety of plant families.' },
    { id: 'diversification', weight: 'your diversification priority', description: 'Number of different crops, up to three (a proxy for spreading weather and market risk).' },
    { id: 'lowInput', weight: 'your cost priority', description: 'Lower typical input intensity (fertiliser, irrigation, labour) scores higher.' },
    { id: 'croppingIntensity', weight: `${BASE_WEIGHTS.croppingIntensity} (fixed)`, description: 'Months of the year the plot is in crop, divided by 12. Income is not estimated; this is only a land-use proxy.' },
    { id: 'stapleSecurity', weight: `${BASE_WEIGHTS.stapleSecurity} (fixed)`, description: 'Number of staple cereal crops (rice, wheat, maize) in the rotation divided by 2, capped at 1.' },
  ],
  filters: [
    { id: 'requireStapleCereal', default: true, description: 'Alternatives must include a staple cereal. Set constraints.requireStapleCereal to false to allow others.' },
    { id: 'onlyDocumentedPatterns', default: true, description: 'Alternatives must be a subset of a cropping pattern reported in a BRRI/BARI survey or trial (data/reference/croppingPatterns.json, not yet agronomist-verified). Set constraints.onlyDocumentedPatterns to false to allow any feasible combination.' },
  ],
  stability: 'Each weight is halved and doubled one at a time and the alternatives re-ranked; the response reports how often the top pick stays first.',
  parameters: {
    minCoverage: MIN_COVERAGE,
    heatScale: HEAT_SCALE,
    irrigationAccessFactor: IRRIGATION_ACCESS_FACTOR,
    onsetDefinition: ONSET,
    preMonsoonHeatC: PREMONSOON_HEAT_C,
    priorityRange: [PRIORITY_MIN, PRIORITY_MAX],
  },
  documentation: 'docs/SCIENTIFIC_METHOD.md',
};

export const LIMITATIONS = [
  'Climate values are NASA POWER grid-cell values (about 0.5 degrees), not measurements on your field.',
  'Crop traits in this version are unverified general-knowledge assumptions and must be reviewed by an agronomist.',
  'The score ranks options under simple rules. It does not predict yield, profit, or soil improvement.',
  'Only the information you enter and the loaded climate data are considered: no prices, pests, diseases, seed supply, labour or flood timing. Erosion, organic matter, forage value and market suitability are not modelled (see notModeled).',
  'The "documented pattern" filter uses a secondary reading of BRRI/BARI papers that an agronomist has not yet confirmed. It does not mean a pattern is recommended for your farm.',
  'Trend statements are indicative: the series are short and a rough statistical hint is not proof of climate change.',
  'Missing days are never treated as zero rain. Rainfall windows use consecutive calendar days; years with too many unobserved days are left out and, for onset and dry spells, the response says which years were unknown.',
];

function districtPublic(d) {
  const { id, ...rest } = d;
  return { ...rest, sharedGridCellWith: d.sharedGridCellWith ?? [] };
}

// Where the series was read from: 'database', or 'offline-file' (a committed snapshot) with the snapshot's export time and a note.
function offlineMarks(p) {
  return p.servedFrom === 'offline-file'
    ? { servedFrom: 'offline-file', offlineExportedAt: p.offlineExportedAt ?? null, offlineNote: p.offlineNote ?? null }
    : { servedFrom: 'database' };
}

function climateNotice(climate) {
  if (!climate) {
    return 'No climate data is loaded for this district yet. Run the NASA ingestion (see docs/SETUP.md). Water and heat components are left out of the scores.';
  }
  if (climate.provenance.isSynthetic) {
    return 'SYNTHETIC DEMO DATA: these climate numbers were generated by software and are NOT NASA observations. Run the NASA ingestion to use real data.';
  }
  return null;
}

export function createEvaluationService(repo) {
  const climateViewCache = new Map();
  const cropClimateCache = new Map();
  const plantingCache = new Map();

  async function climateBundle(district, climateOverride) {
    const climate = climateOverride ?? await repo.getClimate(district.id);
    if (!climate) {
      return {
        status: 'unavailable',
        provenance: null,
        coverage: null,
        indicators: [],
        notice: climateNotice(null),
        dataLabel: null,
        latestObservationDate: null,
        daysSinceLatest: null,
        series: null,
      };
    }
    const cached = climateViewCache.get(climate.provenance.runId);
    if (cached) return cached;
    const bundle = {
      status: 'available',
      provenance: climate.provenance,
      coverage: seriesCoverage(climate.series),
      indicators: climateIndicators(climate.series),
      notice: climateNotice(climate),
      dataLabel: makeDataLabel(climate.provenance, {
        coverageStart: climate.provenance.startDate,
        coverageEnd: climate.provenance.endDate,
      }),
      ...freshnessFor(climate.provenance),
      series: climate.series,
    };
    return boundedSet(climateViewCache, climate.provenance.runId, bundle, 8);
  }

  async function plantingFull(slug, { crop: cropSlug, splitYear }) {
    const district = await repo.getDistrictBySlug(slug);
    if (!district) throw notFound('DISTRICT_NOT_FOUND', `No district with slug "${slug}".`);
    const crops = await repo.listCrops();
    const crop = crops.find((c) => c.slug === cropSlug);
    if (!crop) throw validationError([{ field: 'crop', message: `Unknown crop "${cropSlug}".` }]);
    const climate = await repo.getClimate(district.id);
    if (!climate || climate.provenance.isSynthetic) {
      throw notFound('NO_REAL_CLIMATE_DATA', `No real NASA POWER data is available for district "${slug}".`);
    }
    const split = splitYear ?? PLANTING_SPLIT_YEAR;
    const key = `${climate.provenance.runId}:${crop.slug}:${crop.startMonth}-${crop.endMonth}:${split}`;
    let analysis = plantingCache.get(key);
    if (!analysis) {
      analysis = boundedSet(plantingCache, key, plantingWindowAnalysis(climate.series, crop, { splitYear: split }), 32);
    }

    const years = (analysis.onset.applies ? analysis.onset.yearly : analysis.gdd.yearly).map((p) => p.year);
    const periods = {
      splitYear: split,
      early: { from: Math.min(...years), to: split - 1, years: analysis.onset.analysis?.earlyYears ?? analysis.gdd.analysis.earlyYears },
      late: { from: split, to: Math.max(...years), years: analysis.onset.analysis?.lateYears ?? analysis.gdd.analysis.lateYears },
    };
    const publicDistrict = districtPublic(district);
    const result = {
      district: publicDistrict,
      crop: { slug: crop.slug, nameEn: crop.nameEn, nameBn: crop.nameBn, startMonth: crop.startMonth, endMonth: crop.endMonth, basis: crop.basis, traitSources: crop.traitSources ?? null },
      periods,
      onset: analysis.onset,
      status: 'experimental',
      statusNote: 'Experimental: the onset definitions are unverified agronomic assumptions and the result rests on one modelled rainfall source. Growing degree days are computed internally but not reported.',
      recommendation: analysis.recommendation,
      advisory: buildAdvisory({
        districtEn: publicDistrict.nameEn,
        districtBn: publicDistrict.nameBn,
        cropEn: crop.nameEn,
        cropBn: crop.nameBn,
        recommendation: analysis.recommendation,
        periods,
      }),
      provenance: {
        runId: climate.provenance.runId,
        source: climate.provenance.source,
        dataStatus: climate.provenance.dataStatus ?? 'cached',
        retrievedAt: climate.provenance.retrievedAt,
        isSynthetic: climate.provenance.isSynthetic,
        units: climate.provenance.units,
        startDate: climate.provenance.startDate,
        endDate: climate.provenance.endDate,
        ...offlineMarks(climate.provenance),
      },
      dataLabel: makeDataLabel(climate.provenance, { coverageStart: climate.provenance.startDate, coverageEnd: climate.provenance.endDate }),
      ...freshnessFor(climate.provenance),
      limitations: analysis.limitations,
      disclaimer: DISCLAIMER,
    };
    return { result, analysis };
  }

  return {
    listDistricts: () => repo.listDistricts(),

    async listCrops() {
      const crops = await repo.listCrops();
      return crops.map(({ id, ...c }) => c);
    },

    async cropCompatibility() {
      const crops = await repo.listCrops();
      return {
        maxCrops: MAX_CROPS,
        maxOverlapMonths: MAX_PAIR_OVERLAP_MONTHS,
        rule: `Two crops can share a year when they are in the field together for at most ${MAX_PAIR_OVERLAP_MONTHS} month (typical month windows). A rotation may hold 1 to ${MAX_CROPS} crops, and every pair in it must be compatible.`,
        compatible: compatibilityMap(crops),
      };
    },

    async climateSummary(slug) {
      const district = await repo.getDistrictBySlug(slug);
      if (!district) throw notFound('DISTRICT_NOT_FOUND', `No district with slug "${slug}".`);
      const { series, ...climate } = await climateBundle(district);
      return { district: districtPublic(district), climate };
    },

    async dailyClimate(slug, { from, to }) {
      const district = await repo.getDistrictBySlug(slug);
      if (!district) throw notFound('DISTRICT_NOT_FOUND', `No district with slug "${slug}".`);
      const climate = await repo.getClimate(district.id);
      if (!climate || climate.provenance.isSynthetic) {
        throw notFound('NO_REAL_CLIMATE_DATA', `No real NASA POWER data is available for district "${slug}".`);
      }
      const seriesByDate = new Map(climate.series.map((row) => [row.date, row]));
      const series = [];
      for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const date = cursor.toISOString().slice(0, 10);
        const row = seriesByDate.get(date);
        series.push({ date, precipMm: row?.precipMm ?? null, tMaxC: row?.tMaxC ?? null, tMinC: row?.tMinC ?? null });
      }
      const missing = { precipMm: 0, tMaxC: 0, tMinC: 0 };
      for (const row of series) {
        for (const key of Object.keys(missing)) {
          if (row[key] === null || row[key] === undefined) missing[key] += 1;
        }
      }
      return {
        district: districtPublic(district),
        from,
        to,
        daily: series.map(({ date, precipMm, tMaxC, tMinC }) => ({ date, precipMm, tMaxC, tMinC })),
        provenance: {
          runId: climate.provenance.runId,
          source: climate.provenance.source,
          dataStatus: climate.provenance.dataStatus ?? (climate.provenance.isSynthetic ? 'demo' : 'cached'),
          retrievedAt: climate.provenance.retrievedAt,
          isSynthetic: climate.provenance.isSynthetic,
          units: climate.provenance.units,
          missing,
        },
        dataLabel: makeDataLabel(climate.provenance, { coverageStart: from, coverageEnd: to }),
        ...freshnessFor(climate.provenance),
      };
    },

    // Planting-window advisory for one district and crop, computed from the stored REAL NASA POWER series.
    // Synthetic data is never used for an advisory.
    async plantingWindow(slug, input) {
      return (await plantingFull(slug, input)).result;
    },

    // GET /api/districts/:slug/advisory : the planting-window result turned into one farmer-facing decision.
    async advisory(slug, input) {
      const { result, analysis } = await plantingFull(slug, input);
      return buildFarmerAdvisory({ result, analysis, lang: input.lang, usual: input.usual, includeHeat: input.includeHeat });
    },

    async evaluate(input, sessionId) {
      let field = null;
      if (input.fieldId) {
        if (!repo.getField) throw notFound('FIELD_NOT_FOUND', `No field with id "${input.fieldId}".`);
        field = await repo.getField(input.fieldId, sessionId);
        if (!field) throw notFound('FIELD_NOT_FOUND', `No field with id "${input.fieldId}".`);
        if (field.district?.slug !== input.district) {
          throw validationError([{ field: 'fieldId', message: 'The selected field must belong to the selected district.' }]);
        }
      }
      const district = await repo.getDistrictBySlug(field?.district?.slug ?? input.district);
      if (!district) throw notFound('DISTRICT_NOT_FOUND', `No district with slug "${input.district}".`);

      const crops = await repo.listCrops();
      const known = new Set(crops.map((c) => c.slug));
      const unknown = input.existingRotation.filter((s) => !known.has(s));
      if (unknown.length) {
        throw validationError([{ field: 'existingRotation', message: `Unknown crop(s): ${unknown.join(', ')}.` }]);
      }
      const bySlug = new Map(crops.map((c) => [c.slug, c]));
      const feasible = checkFeasible(input.existingRotation.map((s) => bySlug.get(s)));
      if (!feasible.ok) {
        throw validationError([{ field: 'existingRotation', message: `These crops cannot share one year on the same plot: ${feasible.reason}.` }]);
      }

      // With a registered field, climate comes from the NASA POWER grid cell that contains the field, not
      // from the district's reference point. If that cell has not been ingested the request fails: it never
      // quietly falls back to a different place's data.
      let fieldLocation = null;
      let cellClimate = null;
      if (field) {
        const ctx = repo.getFieldGeoContext ? await repo.getFieldGeoContext(field.id, sessionId) : null;
        if (!ctx) {
          throw validationError([{ field: 'fieldId', message: 'This field has no boundary, so its climate cell cannot be determined.' }]);
        }
        fieldLocation = locateField(ctx);
        cellClimate = repo.getClimateByCell ? await repo.getClimateByCell(fieldLocation.cell) : null;
        if (!cellClimate) {
          throw notFound(
            'CLIMATE_CELL_NOT_INGESTED',
            `No real NASA POWER data has been stored for grid cell ${fieldLocation.cell.cellKey} (centre ${fieldLocation.cell.centerLat}, ${fieldLocation.cell.centerLon}), which contains this field. The cell has not been ingested yet.`,
          );
        }
      }
      const { series, ...climateView } = await climateBundle(district, cellClimate);
      const climate = fieldLocation
        ? { ...climateView, scope: { basis: 'field_grid_cell', cell: fieldLocation.cellBlock, spansMultipleCells: fieldLocation.spans } }
        : climateView;
      const cropClimateMap = {};
      if (series) {
        const runId = climate.provenance.runId;
        const cropKey = `${runId}:${crops.map((c) => `${c.slug}:${c.startMonth}-${c.endMonth}:${c.heatThresholdC}`).join('|')}`;
        const cachedCropClimate = cropClimateCache.get(cropKey);
        if (cachedCropClimate) {
          Object.assign(cropClimateMap, cachedCropClimate);
        } else {
          for (const c of crops) cropClimateMap[c.slug] = cropClimate(series, c);
          boundedSet(cropClimateCache, cropKey, cropClimateMap, 8);
        }
      }

      const soil = {
        ...input.soil,
        ...(field?.salinityDsM !== null && field?.salinityDsM !== undefined
          ? { salinity: salinityFromDsM(field.salinityDsM) }
          : {}),
      };
      const fromField = field?.salinityDsM !== null && field?.salinityDsM !== undefined;
      const soilBasis = {
        salinity: fromField ? 'field_record' : input.soil.salinity === null ? 'not_entered' : 'entered',
        drainage: input.soil.drainage === null ? 'not_entered' : 'entered',
      };
      const result = evaluateRotations({
        crops,
        existingSlugs: input.existingRotation,
        ctx: { cropClimate: cropClimateMap, soil, irrigation: input.irrigation, priorities: input.priorities },
        constraints: input.constraints,
      });

      return {
        district: districtPublic(district),
        input: { ...input, soil },
        soilBasis,
        field: field
          ? { id: field.id, name: field.name, districtId: field.districtId, areaHa: field.areaHa, soilType: field.soilType, soilPh: field.soilPh, salinityDsM: field.salinityDsM, irrigationSource: field.irrigationSource }
          : null,
        climate,
        strategies: result.strategies,
        alternativesConsidered: result.alternativesConsidered,
        constraints: result.constraints,
        stability: result.stability,
        notModeled: NOT_MODELED,
        method: METHOD,
        limitations: fieldLocation ? [...fieldLocation.limitations, ...LIMITATIONS] : LIMITATIONS,
        disclaimer: DISCLAIMER,
      };
    },
  };
}

export { PRIORITIES };
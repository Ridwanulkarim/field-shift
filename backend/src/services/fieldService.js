import { conflict, notFound, validationError } from '../utils/errors.js';
import { FieldDistrictError, FieldGeometryError, FieldSessionConflictError } from '../utils/fieldErrors.js';
import { locateField as locate } from '../geo/fieldLocation.js';
import { sliceDaily } from '../utils/dailySlice.js';
import { makeDataLabel } from '../utils/dataLabel.js';
import { monthlyClimatology, cropFieldEvidence } from '../science/fieldProfile.js';
import { buildFieldSummary, buildFieldSummaryBn } from '../science/fieldSummary.js';
import { salinityClassFromDsM } from '../science/soil.js';
import { seriesCoverage } from '../science/climate.js';
import { compareRainfall } from '../science/rainComparison.js';
import { aggregatePixelRows } from '../science/imergAggregation.js';
import { imergBlockForPoint, imergCellFor, imergPixelFor, imergPixelsInCell } from '../geo/imergGrid.js';

export const RAIN_EVIDENCE_LIMITATIONS = [
  'IMERG is a satellite-based precipitation estimate. The daily Final product used here is published up to about 4 months after the day it describes, so recent months are absent.',
  'This compares two different rainfall estimates for the same cell. Neither is a rain-gauge measurement on the farm. Agreement does not prove either is correct, disagreement does not show which is wrong, and the two products are not guaranteed to be independent.',
  'Thresholds behind the flags are heuristics, not validated standards.',
];

export const IMERG_NATIVE_LIMITATIONS = [
  'This is the native 0.1 degree (about 10 km) IMERG pixel that contains the representative point of the field. A field can span more than one pixel, and the pixel is far larger than most farms; it is not a measurement on the field.',
  'IMERG Final is satellite-based and published up to about 4 months after the day it describes, so recent months are absent.',
  'precipitationCnt is the number of valid half-hourly samples behind the daily value (as reported by NASA); a low count means the day rests on fewer observations. No reliability threshold is applied here.',
]

function sourceBlock(p) {
  return { runId: p.runId, source: p.source, product: p.product, isSynthetic: p.isSynthetic, dataStatus: p.dataStatus, retrievedAt: p.retrievedAt, startDate: p.startDate, endDate: p.endDate, units: p.units, rowCount: p.rowCount, missingCount: p.missingCount, notes: p.notes, resolutionNote: p.resolutionNote };
}

function imergSummary(native, aggregated) {
  const rows = native.rows;
  const dates = rows.map((r) => r.date).sort();
  const versions = new Set(native.runs.flatMap((r) => r.requestParams?.fileVersions ?? []));
  for (const r of rows) if (r.fileVersion) versions.add(r.fileVersion);
  const counts = rows.map((r) => r.precipitationCnt).filter((n) => Number.isInteger(n));
  const retrieved = native.runs.map((r) => r.retrievedAt).sort();
  const first = native.runs[0];
  return {
    source: 'NASA GPM IMERG',
    product: first.product,
    isSynthetic: false,
    dataStatus: 'cached',
    collection: first.requestParams?.collection ?? null,
    versionNote: first.requestParams?.versionNote ?? null,
    fileVersions: [...versions].sort(),
    nativeResolutionDeg: { lat: 0.1, lon: 0.1 },
    pixelRuns: native.runs.length,
    pixelsExpected: aggregated.pixelsExpected,
    pixelsWithData: aggregated.pixelsWithData,
    observationPeriod: dates.length ? { firstDate: dates[0], lastDate: dates[dates.length - 1] } : null,
    retrievedAt: { earliest: retrieved[0], latest: retrieved[retrieved.length - 1] },
    quality: {
      variable: 'precipitation_cnt',
      meaning: 'valid half-hourly samples behind each daily value, as reported by NASA',
      pixelDaysWithCount: counts.length,
      pixelDaysTotal: rows.length,
      meanCount: counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : null,
    },
    aggregation: aggregated.method,
  };
}

const SOIL_FIELDS = ['soilType', 'soilPh', 'organicMatterPct', 'salinityDsM', 'irrigationSource'];
// Of the soil inputs, only salinity is used by this version. The others are echoed, not analysed.
const SOIL_USED = ['salinityDsM'];

export function createFieldService(repo) {
  return {
    async createField(input, sessionId) {
      try {
        const field = await repo.createField(input, sessionId);
        if (!field) throw notFound('DISTRICT_NOT_FOUND', `No district with id "${input.districtId}".`);
        return field;
      } catch (err) {
        if (err instanceof FieldDistrictError) {
          throw notFound('DISTRICT_NOT_FOUND', err.message);
        }
        if (err instanceof FieldGeometryError) {
          throw validationError([{ field: 'boundary', message: err.message }]);
        }
        if (err instanceof FieldSessionConflictError) {
          throw conflict('FIELD_ALREADY_EXISTS', err.message);
        }
        throw err;
      }
    },

    listFields: (sessionId) => repo.listFields(sessionId),

    async getField(id, sessionId) {
      const field = await repo.getField(id, sessionId);
      if (!field) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      return field;
    },

    async updateField(id, input, sessionId) {
      try {
        const field = await repo.updateField(id, input, sessionId);
        if (!field) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
        return field;
      } catch (err) {
        if (err instanceof FieldDistrictError) {
          throw notFound('DISTRICT_NOT_FOUND', err.message);
        }
        if (err instanceof FieldGeometryError) {
          throw validationError([{ field: 'boundary', message: err.message }]);
        }
        throw err;
      }
    },

    // Climate for one registered field. The field polygon adds NO resolution: the answer is the NASA POWER
    // grid cell that contains the field's representative point, and the response says how big that cell is.
    async getFieldClimate(id, sessionId, { from, to }) {
      const ctx = await repo.getFieldGeoContext(id, sessionId);
      if (!ctx) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      const where = locate(ctx);
      const climate = await repo.getClimateByCell(where.cell);
      if (!climate) {
        throw notFound(
          'CLIMATE_CELL_NOT_INGESTED',
          `No real NASA POWER data has been stored for grid cell ${where.cell.cellKey} (centre ${where.cell.centerLat}, ${where.cell.centerLon}), which contains this field. The cell has not been ingested yet.`,
        );
      }
      const { daily, missing } = sliceDaily(climate.series, from, to);
      const requestedDays = Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1);
      const coveredStart = Math.max(Date.parse(`${from}T00:00:00Z`), Date.parse(`${climate.provenance.startDate}T00:00:00Z`));
      const coveredEnd = Math.min(Date.parse(`${to}T00:00:00Z`), Date.parse(`${climate.provenance.endDate}T00:00:00Z`));
      const expectedWithinObservationPeriod = coveredStart <= coveredEnd
        ? Math.round((coveredEnd - coveredStart) / 86400000) + 1
        : 0;
      const availableDays = climate.series.filter((row) => row.date >= from && row.date <= to).length;
      return {
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: where.location,
        cell: where.cellBlock,
        spatialContext: where.spatialContext,
        from,
        to,
        daily,
        provider: climate.provenance.source,
        dataset: climate.provenance.product,
        spatialResolution: { latDeg: where.cellBlock.resolutionDeg.lat, lonDeg: where.cellBlock.resolutionDeg.lon, approximateAreaKm2: where.cellBlock.approxAreaKm2 },
        observationPeriod: { startDate: climate.provenance.startDate, endDate: climate.provenance.endDate },
        coverage: {
          requestedDays,
          returnedDays: daily.length,
          availableDays,
          absentDaysWithinObservationPeriod: Math.max(0, expectedWithinObservationPeriod - availableDays),
          outsideObservationPeriodDays: Math.max(0, requestedDays - expectedWithinObservationPeriod),
          missing,
        },
        provenance: {
          runId: climate.provenance.runId,
          source: climate.provenance.source,
          product: climate.provenance.product,
          dataStatus: climate.provenance.dataStatus,
          retrievedAt: climate.provenance.retrievedAt,
          isSynthetic: climate.provenance.isSynthetic,
          units: climate.provenance.units,
          rowCount: climate.provenance.rowCount,
          missingCount: climate.provenance.missingCount,
          requestParams: climate.provenance.requestParams,
          missing,
        },
        dataLabel: makeDataLabel(climate.provenance, { coverageStart: from, coverageEnd: to }),
        limitations: where.limitations,
      };
    },

    // Rainfall evidence for one field: NASA POWER and GPM IMERG for the SAME grid cell, side by side, with agreement
    // statistics. IMERG is stored at its native 0.1 degree resolution; here, and only here, the pixels inside the POWER cell
    // are averaged (method and spatial limits are returned with the result). Evidence only; it recommends nothing.
    async getFieldRainEvidence(id, sessionId) {
      const ctx = await repo.getFieldGeoContext(id, sessionId);
      if (!ctx) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      const where = locate(ctx);
      const block = imergPixelsInCell(where.cell);
      const [power, native] = await Promise.all([repo.getClimateByCell(where.cell), repo.getImergBlock(block)]);
      if (!power) {
        throw notFound('CLIMATE_CELL_NOT_INGESTED', `No real NASA POWER data has been stored for grid cell ${where.cell.cellKey} (centre ${where.cell.centerLat}, ${where.cell.centerLon}), which contains this field. The cell has not been ingested yet.`);
      }
      if (!native) {
        throw notFound('IMERG_CELL_NOT_INGESTED', `No native GPM IMERG pixels have been stored for the ${block.pixelCount} IMERG pixels inside grid cell ${where.cell.cellKey} (centre ${where.cell.centerLat}, ${where.cell.centerLon}), which contains this field. NASA POWER data exists for it; the comparison needs the IMERG data to be ingested first.`);
      }
      const aggregated = aggregatePixelRows(native.rows, { expectedPixels: native.pixelsExpected });
      const comparison = compareRainfall(power.series, aggregated.series);
      const flags = aggregated.complete ? comparison.flags : [...(comparison.flags ?? []), 'INCOMPLETE_IMERG_PIXEL_BLOCK'];
      const limitations = [...where.limitations, ...RAIN_EVIDENCE_LIMITATIONS, ...aggregated.limitations];
      if (!aggregated.complete) limitations.push(`Only ${aggregated.pixelsWithData} of the ${aggregated.pixelsExpected} IMERG pixels inside the cell have stored data, so days are often missing from the aggregate.`);
      return {
        status: 'preliminary',
        statusNote: 'Evidence only. This compares two rainfall estimates for the field\'s grid cell; it does not recommend a planting date or a crop.',
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: where.location,
        cell: where.cellBlock,
        spatialContext: where.spatialContext,
        comparison: { ...comparison, flags },
        sources: { power: sourceBlock(power.provenance), imerg: imergSummary(native, aggregated) },
        limitations,
      };
    },

    // Native IMERG (0.1 degree) daily values for the pixel that contains the field's representative point, with the valid
    // half-hourly count and the file version of every day. No aggregation.
    async getFieldImergNative(id, sessionId, { from, to }) {
      const ctx = await repo.getFieldGeoContext(id, sessionId);
      if (!ctx) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      const where = locate(ctx);
      const { row, col } = imergPixelFor(ctx.point.lat, ctx.point.lon);
      const pixel = imergCellFor(row, col);
      const native = await repo.getImergBlock(imergBlockForPoint(ctx.point.lat, ctx.point.lon));
      if (!native) {
        throw notFound('IMERG_PIXEL_NOT_INGESTED', `No native GPM IMERG data has been stored for the 0.1 degree pixel ${pixel.cellKey} (centre ${pixel.centerLat}, ${pixel.centerLon}) that contains this field.`);
      }
      const byDate = new Map(native.rows.map((r) => [r.date, r]));
      const daily = [];
      let missing = 0;
      for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const date = cursor.toISOString().slice(0, 10);
        const r = byDate.get(date);
        const day = { date, precipMm: r?.precipMm ?? null, precipitationCnt: r?.precipitationCnt ?? null, fileVersion: r?.fileVersion ?? null };
        if (day.precipMm === null) missing += 1;
        daily.push(day);
      }
      const run = native.runs[0];
      return {
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: where.location,
        pixel: { provider: pixel.provider, cellKey: pixel.cellKey, row, col, centerLat: pixel.centerLat, centerLon: pixel.centerLon, resolutionDeg: { lat: 0.1, lon: 0.1 }, containsRepresentativePoint: true },
        from,
        to,
        daily,
        missingDays: missing,
        provenance: {
          source: 'NASA GPM IMERG',
          runId: run.runId,
          product: run.product,
          collection: run.requestParams.collection,
          versionNote: run.requestParams.versionNote,
          fileVersions: run.requestParams.fileVersions ?? [],
          isSynthetic: false,
          dataStatus: 'cached',
          retrievedAt: run.retrievedAt,
          startDate: run.startDate,
          endDate: run.endDate,
          rowCount: run.rowCount,
          missingCount: run.missingCount,
          units: run.units,
          aggregation: 'none (native pixel values)',
        },
        limitations: IMERG_NATIVE_LIMITATIONS,
      };
    },

    // Field intelligence, version 1: EVIDENCE for this field, not a ranking and not a score.
    // Climate comes from the field's NASA POWER grid cell; soil is only what the farmer entered.
    async getFieldIntelligence(id, sessionId) {
      const ctx = await repo.getFieldGeoContext(id, sessionId);
      if (!ctx) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      const where = locate(ctx);
      const climate = await repo.getClimateByCell(where.cell);
      if (!climate) {
        throw notFound(
          'CLIMATE_CELL_NOT_INGESTED',
          `No real NASA POWER data has been stored for grid cell ${where.cell.cellKey} (centre ${where.cell.centerLat}, ${where.cell.centerLon}), which contains this field. The cell has not been ingested yet.`,
        );
      }
      const allCrops = await repo.listCrops();
      const entered = Object.fromEntries(SOIL_FIELDS.map((k) => [k, ctx.soil?.[k] ?? null]));
      const salinityClass = salinityClassFromDsM(entered.salinityDsM);
      const monthly = monthlyClimatology(climate.series);
      const crops = allCrops.map((c) => cropFieldEvidence(climate.series, c, { salinityClass }));
      const coverage = seriesCoverage(climate.series);
      const summaryInput = {
        monthly,
        crops,
        cell: where.cellBlock,
        areaHa: ctx.areaHa,
        soil: { salinityClass, salinityDsM: entered.salinityDsM },
        spansMultipleCells: where.spans,
      };

      return {
        status: 'preliminary',
        statusNote: 'Version 1 reports evidence only: no crop is ranked or scored. Crop traits are unverified general-knowledge values, and soil is only what was entered for this field.',
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: where.location,
        cell: where.cellBlock,
        spatialContext: where.spatialContext,
        climate: {
          firstDate: coverage.firstDate,
          lastDate: coverage.lastDate,
          missing: coverage.missing,
          absentDays: coverage.absentDays,
          monthly,
        },
        soil: {
          entered,
          salinityClass,
          usedInThisVersion: SOIL_USED,
          enteredButNotUsed: SOIL_FIELDS.filter((k) => !SOIL_USED.includes(k) && entered[k] !== null),
          notEntered: SOIL_FIELDS.filter((k) => entered[k] === null),
        },
        crops,
        summary: {
          en: buildFieldSummary(summaryInput),
          bn: buildFieldSummaryBn(summaryInput),
          reviewStatus: 'BANGLA_DRAFT_NOT_NATIVE_REVIEWED',
        },
        provenance: {
          runId: climate.provenance.runId,
          source: climate.provenance.source,
          product: climate.provenance.product,
          dataStatus: climate.provenance.dataStatus,
          retrievedAt: climate.provenance.retrievedAt,
          isSynthetic: climate.provenance.isSynthetic,
          units: climate.provenance.units,
        },
        dataLabel: makeDataLabel(climate.provenance, { coverageStart: coverage.firstDate, coverageEnd: coverage.lastDate }),
        limitations: [
          ...where.limitations,
          'Monthly figures are historical averages over the years with enough observed days. They describe the past, not a forecast.',
          'Crop water needs, heat thresholds and salinity tolerances are unverified general-knowledge values pending review against BRRI, BARI and BARC sources.',
          'Seasonal rainfall minus assumed water need is arithmetic only. It ignores soil moisture, runoff, timing and irrigation, so it is not an irrigation requirement.',
          'Soil analysis uses only the salinity you entered. Soil type, pH, organic matter and drainage are not analysed in this version.',
          'Nothing here predicts yield, profit or soil improvement.',
        ],
      };
    },

    async deleteField(id, sessionId) {
      const deleted = await repo.deleteField(id, sessionId);
      if (!deleted) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      return { id };
    },
  };
}

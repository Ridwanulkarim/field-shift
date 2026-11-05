import { conflict, notFound, validationError } from '../utils/errors.js';
import { FieldDistrictError, FieldGeometryError, FieldSessionConflictError } from '../utils/fieldErrors.js';
import { approxCellAreaKm2, powerCellFor, POWER_GRID, spansMultipleCells } from '../geo/climateGrid.js';
import { sliceDaily } from '../utils/dailySlice.js';
import { makeDataLabel } from '../utils/dataLabel.js';
import { monthlyClimatology, cropFieldEvidence } from '../science/fieldProfile.js';
import { buildFieldSummary } from '../science/fieldSummary.js';
import { salinityClassFromDsM } from '../science/soil.js';
import { seriesCoverage } from '../science/climate.js';

// Where a field sits on the climate grid. Shared by the climate and intelligence endpoints so both
// describe the cell in exactly the same way.
function locate(ctx) {
  const cell = powerCellFor(ctx.point.lat, ctx.point.lon);
  const cellAreaKm2 = approxCellAreaKm2(cell);
  const spans = spansMultipleCells(ctx.bbox);
  const limitations = [
    `Values describe the whole NASA POWER grid cell (${cell.resLatDeg} x ${cell.resLonDeg} degrees, about ${Math.round(cellAreaKm2).toLocaleString('en-US')} km2) that contains the field's representative point. They are not measurements taken at the field, and the field boundary adds no spatial detail.`,
  ];
  if (spans) limitations.push("The field's bounding box crosses a grid-cell edge, so part of the field lies in a neighbouring cell. Only the cell containing the representative point is reported.");
  if (!POWER_GRID.verified) limitations.push('The cell geometry follows the assumed POWER grid (0.5 x 0.625 degrees) and has not yet been confirmed against the live service (npm run check:power-grid).');
  return {
    cell,
    cellAreaKm2,
    spans,
    limitations,
    location: { representativePoint: { lat: ctx.point.lat, lon: ctx.point.lon, method: 'ST_PointOnSurface' } },
    cellBlock: {
      provider: cell.provider,
      cellKey: cell.cellKey,
      centerLat: cell.centerLat,
      centerLon: cell.centerLon,
      resolutionDeg: { lat: cell.resLatDeg, lon: cell.resLonDeg },
      approxAreaKm2: Math.round(cellAreaKm2),
      gridVerified: POWER_GRID.verified,
    },
    spatialContext: {
      fieldAreaHa: ctx.areaHa,
      fieldToCellAreaRatio: ctx.areaHa === null ? null : Number((ctx.areaHa / 100 / cellAreaKm2).toExponential(2)),
      spansMultipleCells: spans,
    },
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
      return {
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: where.location,
        cell: where.cellBlock,
        spatialContext: where.spatialContext,
        from,
        to,
        daily,
        provenance: {
          runId: climate.provenance.runId,
          source: climate.provenance.source,
          product: climate.provenance.product,
          dataStatus: climate.provenance.dataStatus,
          retrievedAt: climate.provenance.retrievedAt,
          isSynthetic: climate.provenance.isSynthetic,
          units: climate.provenance.units,
          missing,
        },
        dataLabel: makeDataLabel(climate.provenance, { coverageStart: from, coverageEnd: to }),
        limitations: where.limitations,
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
          en: buildFieldSummary({
            monthly,
            crops,
            cell: where.cellBlock,
            areaHa: ctx.areaHa,
            soil: { salinityClass, salinityDsM: entered.salinityDsM },
            spansMultipleCells: where.spans,
          }),
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

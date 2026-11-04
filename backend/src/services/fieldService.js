import { conflict, notFound, validationError } from '../utils/errors.js';
import { FieldDistrictError, FieldGeometryError, FieldSessionConflictError } from '../utils/fieldErrors.js';
import { approxCellAreaKm2, powerCellFor, POWER_GRID, spansMultipleCells } from '../geo/climateGrid.js';
import { sliceDaily } from '../utils/dailySlice.js';
import { makeDataLabel } from '../utils/dataLabel.js';

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
      const cell = powerCellFor(ctx.point.lat, ctx.point.lon);
      const cellAreaKm2 = approxCellAreaKm2(cell);
      const spans = spansMultipleCells(ctx.bbox);
      const climate = await repo.getClimateByCell(cell);
      if (!climate) {
        throw notFound(
          'CLIMATE_CELL_NOT_INGESTED',
          `No real NASA POWER data has been stored for grid cell ${cell.cellKey} (centre ${cell.centerLat}, ${cell.centerLon}), which contains this field. The cell has not been ingested yet.`,
        );
      }
      const { daily, missing } = sliceDaily(climate.series, from, to);
      const limitations = [
        `Values describe the whole NASA POWER grid cell (${cell.resLatDeg} x ${cell.resLonDeg} degrees, about ${Math.round(cellAreaKm2).toLocaleString('en-US')} km2) that contains the field's representative point. They are not measurements taken at the field, and the field boundary adds no spatial detail.`,
      ];
      if (spans) limitations.push("The field's bounding box crosses a grid-cell edge, so part of the field lies in a neighbouring cell. Only the cell containing the representative point is reported.");
      if (!POWER_GRID.verified) limitations.push('The cell geometry follows the assumed POWER grid (0.5 x 0.625 degrees) and has not yet been confirmed against the live service (npm run check:power-grid).');
      return {
        field: { id: ctx.id, name: ctx.name, areaHa: ctx.areaHa, district: ctx.district },
        location: { representativePoint: { lat: ctx.point.lat, lon: ctx.point.lon, method: 'ST_PointOnSurface' } },
        cell: {
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
        limitations,
      };
    },

    async deleteField(id, sessionId) {
      const deleted = await repo.deleteField(id, sessionId);
      if (!deleted) throw notFound('FIELD_NOT_FOUND', `No field with id "${id}".`);
      return { id };
    },
  };
}

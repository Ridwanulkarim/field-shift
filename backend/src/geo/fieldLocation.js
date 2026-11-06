// Where a registered field sits on the climate grid, in the shape both the field endpoints and the
// rotation evaluation use. Pure: no database, no network.
import { approxCellAreaKm2, powerCellFor, POWER_GRID } from './climateGrid.js';

// Where a field sits on the climate grid. Shared by the climate and intelligence endpoints so both
// describe the cell in exactly the same way.
export function locateField(ctx) {
  const cell = powerCellFor(ctx.point.lat, ctx.point.lon);
  const cellAreaKm2 = approxCellAreaKm2(cell);
  const spans = ctx.spansMultipleCells === true;
  const limitations = [
    `Values describe the whole NASA POWER grid cell (${cell.resLatDeg} x ${cell.resLonDeg} degrees, about ${Math.round(cellAreaKm2).toLocaleString('en-US')} km2) that contains the field's representative point. They are not measurements taken at the field, and the field boundary adds no spatial detail.`,
  ];
  if (spans) limitations.push("The field polygon intersects more than one provider grid cell. Only the cell containing the representative point is reported.");
  if (!POWER_GRID.verified) limitations.push('The cell geometry follows the assumed POWER grid (0.5 x 0.625 degrees) and has not yet been confirmed against the live service (npm run check:power-grid).');
  return {
    cell,
    cellAreaKm2,
    spans,
    limitations,
    location: { representativePoint: { lat: ctx.point.lat, lon: ctx.point.lon, method: 'ST_PointOnSurface' } },
    cellBlock: {
      provider: cell.provider,
      gridName: cell.gridName,
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

// Geometry of the GPM IMERG grid, and how its 0.1-degree pixels sit inside one NASA POWER cell.
// Pure functions only: no network, no database, so everything here is unit-tested.
//
// WHY: IMERG is satellite-based precipitation on a 0.1 x 0.1 degree grid (about 10 km). NASA POWER rainfall is one
// value per 0.5 x 0.625 degree cell. To compare them honestly we average the IMERG pixels whose centres fall
// inside the POWER cell. Nothing is interpolated.
//
// GRID (GPM_3IMERGDF V07, from the GES DISC product description): global, 0.1 degree, 3600 columns x 1800 rows,
// pixel centres at -179.95 ... 179.95 (longitude) and -89.95 ... 89.95 (latitude). The dimension ORDER of the
// daily file (time, lon, lat) must be confirmed with `npm run probe:imerg` before it is relied on.

import { POWER_GRID } from './climateGrid.js';

export const IMERG_GRID = Object.freeze({
  product: 'GPM_3IMERGDF',
  version: '07',
  resolutionDeg: 0.1,
  columns: 3600,
  rows: 1800,
  firstCentreLon: -179.95,
  firstCentreLat: -89.95,
});

const EPS = 1e-9;

function assertCoordinate(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Latitude must be -90..90 and longitude -180..180 (finite numbers).');
  }
}

// Index of the pixel that CONTAINS a point. A point exactly on a pixel edge belongs to the pixel above/east of it.
export function imergPixelFor(lat, lon) {
  assertCoordinate(lat, lon);
  const col = Math.min(IMERG_GRID.columns - 1, Math.floor((lon + 180) * 10 + EPS));
  const row = Math.min(IMERG_GRID.rows - 1, Math.floor((lat + 90) * 10 + EPS));
  return {
    col, row,
    centerLon: Math.round((IMERG_GRID.firstCentreLon + col * IMERG_GRID.resolutionDeg) * 1e6) / 1e6,
    centerLat: Math.round((IMERG_GRID.firstCentreLat + row * IMERG_GRID.resolutionDeg) * 1e6) / 1e6,
  };
}

// Pixel index range whose CENTRES lie in [lo, hi) for one axis. origin is -180 or -90.
function centreRange(lo, hi, origin) {
  const first = Math.ceil((lo - origin) * 10 - 0.5 - EPS);
  const last = Math.ceil((hi - origin) * 10 - 0.5 - EPS) - 1;
  return { first, last };
}

// The IMERG pixels whose centres fall inside a POWER cell (a value from powerCellFor). The lower edge is inclusive,
// the upper edge exclusive, so a pixel is never counted in two neighbouring cells.
export function imergPixelsInCell(cell) {
  const halfLat = POWER_GRID.resLatDeg / 2;
  const halfLon = POWER_GRID.resLonDeg / 2;
  const lat = centreRange(cell.centerLat - halfLat, cell.centerLat + halfLat, -90);
  const lon = centreRange(cell.centerLon - halfLon, cell.centerLon + halfLon, -180);
  const rowFirst = Math.max(0, lat.first);
  const rowLast = Math.min(IMERG_GRID.rows - 1, lat.last);
  const colFirst = Math.max(0, lon.first);
  const colLast = Math.min(IMERG_GRID.columns - 1, lon.last);
  return {
    rows: { first: rowFirst, last: rowLast, count: rowLast - rowFirst + 1 },
    cols: { first: colFirst, last: colLast, count: colLast - colFirst + 1 },
    pixelCount: (rowLast - rowFirst + 1) * (colLast - colFirst + 1),
    bounds: {
      minLat: cell.centerLat - halfLat, maxLat: cell.centerLat + halfLat,
      minLon: cell.centerLon - halfLon, maxLon: cell.centerLon + halfLon,
    },
  };
}

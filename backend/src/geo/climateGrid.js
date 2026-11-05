// Geometry of the climate-data grid, and the geographic guards for registered fields.
// Pure functions only: no database, no network, so everything here is unit-tested.
//
// WHY THIS EXISTS: NASA POWER does not have one value per field or per district. It has one value per
// grid cell. A field polygon is far smaller than a cell and gives NO extra climate detail, so the honest
// way to attach climate to a field is to find the cell that contains the field's representative point
// and report that cell's data, labelled with the cell's size. Nothing is interpolated or blended.
//
// GRID: the POWER meteorology grid is 0.5 degrees of latitude by 0.625 degrees of longitude, with cell centres at
// latitude k * 0.5 and longitude -180 + j * 0.625 (the MERRA-2 grid that POWER's meteorological data are built on).
// VERIFIED 2026-11-04 against the live service and the stored district series (see docs/DATA_SOURCES.md):
//   - `npm run check:power-grid`: POWER's temperatures change within one 0.05-degree sampling step of every expected
//     edge (latitude 24.25 and 24.75, longitude 88.4375 and 89.0625), with no unexpected edge.
//   - `npm run check:grid-consistency`: the 12 stored districts group exactly as the grid predicts.
// The edge positions are known to about +/- 0.025 degrees (the sampling step), and the probe covered the Rajshahi
// area only. Re-run both checks if these constants are ever changed.

export const BANGLADESH_BBOX = Object.freeze({ minLon: 88.0, maxLon: 92.7, minLat: 20.5, maxLat: 26.7 });

// Data-entry guard, not a boundary test: a field further than this from its district's reference
// point is almost certainly filed under the wrong district.
export const MAX_DISTRICT_DISTANCE_KM = 100;

export const POWER_GRID = Object.freeze({
  provider: 'NASA POWER',
  gridName: 'NASA POWER meteorology grid (assumed MERRA-2: 0.5 deg latitude x 0.625 deg longitude)',
  resLatDeg: 0.5,
  resLonDeg: 0.625,
  lonOrigin: -180,
  verified: true,
});

function assertCoordinate(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
    || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Latitude must be -90..90 and longitude -180..180 (finite numbers).');
  }
}

const latIndex = (lat) => Math.round(lat / POWER_GRID.resLatDeg);
const lonIndex = (lon) => Math.round((lon - POWER_GRID.lonOrigin) / POWER_GRID.resLonDeg);

// The grid cell that contains a point (the nearest cell centre). A point exactly on a cell edge goes to
// the cell with the larger index (Math.round rounds halves up), so the rule is deterministic.
export function powerCellFor(lat, lon) {
  assertCoordinate(lat, lon);
  const li = latIndex(lat);
  const lj = lonIndex(lon);
  const centerLat = li * POWER_GRID.resLatDeg;
  const centerLon = POWER_GRID.lonOrigin + lj * POWER_GRID.resLonDeg;
  return {
    provider: POWER_GRID.provider,
    gridName: POWER_GRID.gridName,
    cellKey: `${li}:${lj}`,
    centerLat,
    centerLon,
    resLatDeg: POWER_GRID.resLatDeg,
    resLonDeg: POWER_GRID.resLonDeg,
    bounds: {
      minLat: centerLat - POWER_GRID.resLatDeg / 2,
      maxLat: centerLat + POWER_GRID.resLatDeg / 2,
      minLon: centerLon - POWER_GRID.resLonDeg / 2,
      maxLon: centerLon + POWER_GRID.resLonDeg / 2,
    },
  };
}

// Approximate cell area on a sphere (km2). Good enough to say "a cell is thousands of km2".
export function approxCellAreaKm2(cell) {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const { minLat, maxLat, minLon, maxLon } = cell.bounds;
  return Math.abs(R * R * (maxLon - minLon) * toRad * (Math.sin(maxLat * toRad) - Math.sin(minLat * toRad)));
}

// Smallest lon/lat box around every position of a GeoJSON Polygon or MultiPolygon.
export function geometryBbox(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

export function isInsideBangladeshBox(bbox) {
  return bbox.minLon >= BANGLADESH_BBOX.minLon && bbox.maxLon <= BANGLADESH_BBOX.maxLon
    && bbox.minLat >= BANGLADESH_BBOX.minLat && bbox.maxLat <= BANGLADESH_BBOX.maxLat;
}

// Legacy bbox-only estimate retained for callers that need a cheap coarse pre-check. Field climate
// responses must use the exact PostGIS polygon/grid intersection in repository.getFieldGeoContext.
export function spansMultipleCells(bbox) {
  return latIndex(bbox.minLat) !== latIndex(bbox.maxLat) || lonIndex(bbox.minLon) !== lonIndex(bbox.maxLon);
}

// Where the cell edges should be on one axis between two positions, according to the assumed grid.
// Latitude edges lie at 0.25 + 0.5 k degrees; longitude edges at -180 + 0.625 (j + 0.5) degrees.
export function expectedEdges(axis, from, to) {
  const res = axis === 'lat' ? POWER_GRID.resLatDeg : POWER_GRID.resLonDeg;
  const origin = axis === 'lat' ? 0 : POWER_GRID.lonOrigin;
  const edges = [];
  for (let k = Math.floor((from - origin) / res) - 1; k <= Math.ceil((to - origin) / res) + 1; k += 1) {
    const edge = origin + res * (k + 0.5);
    if (edge > from && edge < to) edges.push(edge);
  }
  return edges;
}

import { describe, it, expect } from 'vitest';
import {
  powerCellFor, approxCellAreaKm2, geometryBbox, isInsideBangladeshBox, spansMultipleCells, expectedEdges, POWER_GRID,
} from '../src/geo/climateGrid.js';

describe('powerCellFor', () => {
  it('finds the cell containing a point', () => {
    const cell = powerCellFor(24.37, 88.6);
    expect(cell.cellKey).toBe('49:430');
    expect(cell.centerLat).toBe(24.5);
    expect(cell.centerLon).toBe(88.75);
    expect(cell.bounds.minLat).toBe(24.25);
    expect(cell.bounds.maxLat).toBe(24.75);
    expect(cell.bounds.minLon).toBe(88.4375);
    expect(cell.bounds.maxLon).toBe(89.0625);
    expect(cell.provider).toBe('NASA POWER');
  });

  it('puts the query point inside the bounds of its own cell', () => {
    for (const [lat, lon] of [[20.6, 88.1], [22.81, 89.55], [26.6, 92.6], [24.37, 88.6], [21.45, 91.98]]) {
      const { bounds } = powerCellFor(lat, lon);
      expect(lat).toBeGreaterThanOrEqual(bounds.minLat);
      expect(lat).toBeLessThanOrEqual(bounds.maxLat);
      expect(lon).toBeGreaterThanOrEqual(bounds.minLon);
      expect(lon).toBeLessThanOrEqual(bounds.maxLon);
    }
  });

  it('gives nearby points in one cell the same key, and a point in the next cell a different key', () => {
    expect(powerCellFor(24.3, 88.75).cellKey).toBe(powerCellFor(24.37, 88.6).cellKey);
    expect(powerCellFor(24.87, 88.6).cellKey).not.toBe(powerCellFor(24.37, 88.6).cellKey);
  });

  it('maps a cell centre to its own cell and decides edges deterministically', () => {
    const c = powerCellFor(24.5, 88.75);
    expect(powerCellFor(c.centerLat, c.centerLon).cellKey).toBe(c.cellKey);
    expect(powerCellFor(24.25, 88.75).cellKey).toBe(powerCellFor(24.25, 88.75).cellKey); // an edge point always gives one answer
  });

  it('rejects impossible coordinates', () => {
    expect(() => powerCellFor(91, 88)).toThrow();
    expect(() => powerCellFor(24, 181)).toThrow();
    expect(() => powerCellFor(NaN, 88)).toThrow();
    expect(() => powerCellFor('24', 88)).toThrow();
  });
});

describe('approxCellAreaKm2', () => {
  it('is a few thousand km2 for a Bangladesh cell, far larger than any field', () => {
    const area = approxCellAreaKm2(powerCellFor(24.37, 88.6));
    expect(area).toBeGreaterThan(3000);
    expect(area).toBeLessThan(4000);
  });
});

describe('geometryBbox and Bangladesh box', () => {
  const polygon = { type: 'Polygon', coordinates: [[[88.6, 24.37], [88.62, 24.37], [88.62, 24.39], [88.6, 24.37]]] };
  it('computes the bounding box of a polygon and a multipolygon', () => {
    expect(geometryBbox(polygon)).toEqual({ minLon: 88.6, maxLon: 88.62, minLat: 24.37, maxLat: 24.39 });
    const multi = { type: 'MultiPolygon', coordinates: [polygon.coordinates, [[[90, 23], [90.1, 23], [90.1, 23.1], [90, 23]]]] };
    expect(geometryBbox(multi)).toEqual({ minLon: 88.6, maxLon: 90.1, minLat: 23, maxLat: 24.39 });
  });
  it('accepts Bangladesh and rejects elsewhere', () => {
    expect(isInsideBangladeshBox(geometryBbox(polygon))).toBe(true);
    expect(isInsideBangladeshBox({ minLon: -60, maxLon: -59.9, minLat: -10, maxLat: -9.9 })).toBe(false);
    expect(isInsideBangladeshBox({ minLon: 24.37, maxLon: 24.38, minLat: 88.6, maxLat: 88.7 })).toBe(false); // swapped lat/lon
  });
});

describe('spansMultipleCells', () => {
  it('is false for a small field inside one cell', () => {
    expect(spansMultipleCells({ minLon: 88.6, maxLon: 88.61, minLat: 24.37, maxLat: 24.38 })).toBe(false);
  });
  it('is true when the box crosses a latitude or a longitude cell edge', () => {
    expect(spansMultipleCells({ minLon: 88.6, maxLon: 88.61, minLat: 24.7, maxLat: 24.8 })).toBe(true); // lat edge 24.75
    expect(spansMultipleCells({ minLon: 89.0, maxLon: 89.1, minLat: 24.4, maxLat: 24.41 })).toBe(true); // lon edge 89.0625
  });
});

describe('expectedEdges', () => {
  it('lists the latitude edges of the assumed grid between two positions', () => {
    expect(expectedEdges('lat', 24.0, 25.0)).toEqual([24.25, 24.75]);
  });
  it('lists the longitude edges of the assumed grid between two positions', () => {
    expect(expectedEdges('lon', 88.3, 89.3)).toEqual([88.4375, 89.0625]);
  });
  it('agrees with powerCellFor: points either side of an edge fall in different cells', () => {
    for (const edge of expectedEdges('lat', 24.0, 25.0)) {
      expect(powerCellFor(edge - 0.001, 88.75).cellKey).not.toBe(powerCellFor(edge + 0.001, 88.75).cellKey);
    }
    for (const edge of expectedEdges('lon', 88.3, 89.3)) {
      expect(powerCellFor(24.5, edge - 0.001).cellKey).not.toBe(powerCellFor(24.5, edge + 0.001).cellKey);
    }
  });
});

describe('POWER_GRID', () => {
  it('records the verified grid, which must be re-checked if any constant changes', () => {
    expect(POWER_GRID).toMatchObject({ resLatDeg: 0.5, resLonDeg: 0.625, lonOrigin: -180, verified: true });
  });
});

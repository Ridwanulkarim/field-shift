import { describe, it, expect } from 'vitest';
import { imergPixelFor, imergPixelsInCell, IMERG_GRID, imergCellFor, imergBlockForPoint, imergPixelList, IMERG_PROVIDER } from '../src/geo/imergGrid.js';
import { powerCellFor } from '../src/geo/climateGrid.js';

describe('imergPixelFor', () => {
  it('finds the 0.1 degree pixel that contains Rajshahi', () => {
    expect(imergPixelFor(24.37, 88.6)).toEqual({ col: 2686, row: 1143, centerLon: 88.65, centerLat: 24.35 });
  });
  it('puts a point on a pixel edge in the pixel above and east of it', () => {
    expect(imergPixelFor(0, 0)).toMatchObject({ col: 1800, row: 900 });
  });
  it('handles the grid corners', () => {
    expect(imergPixelFor(-90, -180)).toMatchObject({ col: 0, row: 0, centerLon: -179.95, centerLat: -89.95 });
    expect(imergPixelFor(90, 180)).toMatchObject({ col: IMERG_GRID.columns - 1, row: IMERG_GRID.rows - 1 });
  });
  it('rejects bad coordinates', () => {
    expect(() => imergPixelFor(91, 0)).toThrow();
    expect(() => imergPixelFor(0, 181)).toThrow();
    expect(() => imergPixelFor(NaN, 0)).toThrow();
    expect(() => imergPixelFor('24', 88)).toThrow();
  });
});

describe('imergPixelsInCell', () => {
  it('finds 5 rows x 7 columns (35 pixels) in the Rajshahi POWER cell', () => {
    const p = imergPixelsInCell(powerCellFor(24.37, 88.6));
    expect(p.rows).toEqual({ first: 1142, last: 1146, count: 5 });
    expect(p.cols).toEqual({ first: 2684, last: 2690, count: 7 });
    expect(p.pixelCount).toBe(35);
    expect(p.bounds).toEqual({ minLat: 24.25, maxLat: 24.75, minLon: 88.4375, maxLon: 89.0625 });
  });
  it('keeps every pixel centre inside the cell bounds', () => {
    const cell = powerCellFor(23.6, 89.84);
    const p = imergPixelsInCell(cell);
    const centreLat = (row) => -89.95 + row * 0.1;
    const centreLon = (col) => -179.95 + col * 0.1;
    for (const row of [p.rows.first, p.rows.last]) {
      expect(centreLat(row)).toBeGreaterThanOrEqual(p.bounds.minLat - 1e-9);
      expect(centreLat(row)).toBeLessThan(p.bounds.maxLat);
    }
    for (const col of [p.cols.first, p.cols.last]) {
      expect(centreLon(col)).toBeGreaterThanOrEqual(p.bounds.minLon - 1e-9);
      expect(centreLon(col)).toBeLessThan(p.bounds.maxLon);
    }
  });
  it('never counts a pixel in two neighbouring cells', () => {
    const a = imergPixelsInCell(powerCellFor(24.37, 88.6));
    const north = imergPixelsInCell(powerCellFor(24.9, 88.6));
    expect(north.rows.first).toBe(a.rows.last + 1);
    expect(north.cols).toEqual(a.cols);
  });
});

describe('native IMERG pixels as grid cells of their own', () => {
  it('describes a pixel as a cell of provider "NASA GPM IMERG", independent of the POWER grid', () => {
    expect(imergCellFor(1143, 2686)).toMatchObject({ provider: IMERG_PROVIDER, cellKey: '1143:2686', centerLat: 24.35, centerLon: 88.65, resLatDeg: 0.1, resLonDeg: 0.1 });
    expect(IMERG_PROVIDER).toBe('NASA GPM IMERG');
  });
  it('rejects pixels outside the grid', () => {
    expect(() => imergCellFor(-1, 0)).toThrow();
    expect(() => imergCellFor(1800, 0)).toThrow();
    expect(() => imergCellFor(0, 3600)).toThrow();
    expect(() => imergCellFor(1.5, 0)).toThrow();
  });
  it('names the collection version separately from any file version', () => {
    expect(IMERG_GRID.version).toBe('07');
  });
  it('a point maps to a one-pixel block', () => {
    const b = imergBlockForPoint(24.37, 88.6);
    expect(b).toMatchObject({ pixelCount: 1, rows: { first: 1143, last: 1143, count: 1 }, cols: { first: 2686, last: 2686, count: 1 } });
    expect(b.bounds).toEqual({ minLat: 24.3, maxLat: 24.4, minLon: 88.6, maxLon: 88.7 });
  });
  it('lists every pixel of a block, row by row, once each', () => {
    const list = imergPixelList(imergPixelsInCell(powerCellFor(24.37, 88.6)));
    expect(list).toHaveLength(35);
    expect(new Set(list.map((p) => p.cellKey)).size).toBe(35);
    expect(list[0].cellKey).toBe('1142:2684');
    expect(list[34].cellKey).toBe('1146:2690');
  });
});

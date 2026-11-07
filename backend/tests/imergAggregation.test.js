import { describe, it, expect } from 'vitest';
import { aggregatePixelRows, AGGREGATION_METHOD, AGGREGATION_LIMITATIONS, MIN_VALID_PIXEL_SHARE } from '../src/science/imergAggregation.js';

const rows = (date, values, cnts = []) => values.map((v, i) => ({ cellKey: `p${i}`, date, precipMm: v, precipitationCnt: cnts[i] ?? 48 }));

describe('aggregatePixelRows (a read-time comparison step, never applied to stored data)', () => {
  it('is the equal-weight mean of the pixels with a value', () => {
    const a = aggregatePixelRows(rows('2020-07-01', [0, 2, 4, 6, 8]), { expectedPixels: 5 });
    expect(a.series).toEqual([{ date: '2020-07-01', precipMm: 4, validPixels: 5, pixelCount: 5, meanHalfHourCount: 48, minHalfHourCount: 48 }]);
    expect(a.complete).toBe(true);
    expect(a.pixelsWithData).toBe(5);
  });
  it('counts zero rain as a value, so a dry day is 0', () => {
    expect(aggregatePixelRows(rows('2020-07-01', [0, 0, 0, 0, 0]), { expectedPixels: 5 }).series[0].precipMm).toBe(0);
  });
  it('excludes missing pixels instead of treating them as zero', () => {
    const a = aggregatePixelRows(rows('2020-07-01', [10, 10, 10, 10, null]), { expectedPixels: 5 });
    expect(a.series[0].precipMm).toBe(10); // not 8
    expect(a.series[0].validPixels).toBe(4);
  });
  it('makes a day missing when fewer than 80% of the expected pixels have a value', () => {
    expect(MIN_VALID_PIXEL_SHARE).toBe(0.8);
    expect(aggregatePixelRows(rows('d', [1, 1, 1, null, null]), { expectedPixels: 5 }).series[0].precipMm).toBeNull(); // 60%
    expect(aggregatePixelRows(rows('d', [1, 1, 1, 1, null]), { expectedPixels: 5 }).series[0].precipMm).toBe(1); // 80%
  });
  it('counts pixels that were never ingested against the day', () => {
    // only 3 of the 5 expected pixels exist in the data at all
    const a = aggregatePixelRows(rows('d', [1, 1, 1]), { expectedPixels: 5 });
    expect(a.series[0].precipMm).toBeNull();
    expect(a.complete).toBe(false);
    expect(a.pixelsWithData).toBe(3);
  });
  it('summarises the half-hourly quality count of the pixels it used', () => {
    const a = aggregatePixelRows(rows('d', [1, 1, 1, 1, 1], [48, 48, 40, 48, 12]), { expectedPixels: 5 });
    expect(a.series[0].minHalfHourCount).toBe(12);
    expect(a.series[0].meanHalfHourCount).toBe(39.2);
  });
  it('sorts by date and handles several days', () => {
    const a = aggregatePixelRows([...rows('2020-07-02', [4, 4]), ...rows('2020-07-01', [2, 2])], { expectedPixels: 2 });
    expect(a.series.map((d) => [d.date, d.precipMm])).toEqual([['2020-07-01', 2], ['2020-07-02', 4]]);
  });
  it('documents the method and the spatial limitations in every result', () => {
    const a = aggregatePixelRows(rows('d', [1, 1]), { expectedPixels: 2 });
    expect(a.method).toBe(AGGREGATION_METHOD);
    expect(a.method.weighting).toMatch(/equal/);
    expect(a.method.pixelAssignment).toMatch(/centre/);
    expect(a.limitations).toBe(AGGREGATION_LIMITATIONS);
    expect(a.limitations.join(' ')).toMatch(/approximates the NASA POWER cell footprint/);
  });
  it('rejects a bad expectedPixels', () => {
    expect(() => aggregatePixelRows([], { expectedPixels: 0 })).toThrow();
    expect(() => aggregatePixelRows([], {})).toThrow();
  });
  it('returns an empty series for no rows', () => {
    expect(aggregatePixelRows([], { expectedPixels: 35 })).toMatchObject({ series: [], pixelsWithData: 0, complete: false });
  });
});

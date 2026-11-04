import { describe, it, expect } from 'vitest';
import { parseFieldRequest } from '../src/validation/fieldRequest.js';

const ring = (lon, lat) => [[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat]];
const body = (boundary) => ({ name: 'F', districtId: 1, boundary });

function errorsFor(request, options) {
  try { parseFieldRequest(request, options); return []; } catch (err) { return err.details ?? []; }
}

describe('field boundary must lie in Bangladesh', () => {
  it('accepts a boundary inside Bangladesh', () => {
    expect(errorsFor(body({ type: 'Polygon', coordinates: [ring(88.6, 24.37)] }))).toEqual([]);
  });
  it('rejects a boundary in another country', () => {
    const errors = errorsFor(body({ type: 'Polygon', coordinates: [ring(-60, -10)] }));
    expect(errors.some((e) => e.field === 'boundary' && /Bangladesh/.test(e.message))).toBe(true);
  });
  it('rejects coordinates given as [latitude, longitude]', () => {
    const errors = errorsFor(body({ type: 'Polygon', coordinates: [ring(24.37, 88.6)] }));
    expect(errors.some((e) => /Bangladesh/.test(e.message))).toBe(true);
  });
  it('rejects when only one part of a MultiPolygon is outside', () => {
    const errors = errorsFor(body({ type: 'MultiPolygon', coordinates: [[ring(88.6, 24.37)], [ring(10, 10)]] }));
    expect(errors.some((e) => /Bangladesh/.test(e.message))).toBe(true);
  });
  it('applies to partial updates that change the boundary, and not to those that do not', () => {
    expect(errorsFor({ boundary: { type: 'Polygon', coordinates: [ring(-60, -10)] } }, { partial: true }).length).toBeGreaterThan(0);
    expect(errorsFor({ name: 'Renamed' }, { partial: true })).toEqual([]);
  });
  it('does not add a second message when the coordinates are already malformed', () => {
    const errors = errorsFor(body({ type: 'Polygon', coordinates: [[[1, 2], [3, 4]]] }));
    expect(errors.some((e) => /Bangladesh/.test(e.message))).toBe(false);
  });
});

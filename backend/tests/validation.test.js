import { describe, it, expect } from 'vitest';
import { parseEvaluateRequest } from '../src/validation/evaluateRequest.js';
import { HttpError } from '../src/utils/errors.js';

const valid = { district: 'rajshahi', existingRotation: ['boro', 'aman'] };

function errorsOf(body) {
  try {
    parseEvaluateRequest(body);
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect(e.status).toBe(422);
    return e.details.map((d) => d.field);
  }
  return null;
}

describe('parseEvaluateRequest', () => {
  it('fills in defaults', () => {
    const r = parseEvaluateRequest(valid);
    expect(r.soil).toEqual({ salinity: 'none', drainage: 'good' });
    expect(r.irrigation).toBe('limited');
    expect(r.priorities).toEqual({ waterSaving: 1, heatResilience: 1, soilHealth: 1, diversification: 1, lowInput: 1 });
  });
  it('accepts full input', () => {
    const r = parseEvaluateRequest({
      ...valid,
      soil: { salinity: 'moderate', drainage: 'poor' },
      irrigation: 'reliable',
      priorities: { waterSaving: 3, lowInput: 0 },
    });
    expect(r.soil.salinity).toBe('moderate');
    expect(r.priorities.waterSaving).toBe(3);
    expect(r.priorities.lowInput).toBe(0);
    expect(r.priorities.soilHealth).toBe(1);
  });
  it('rejects a body that is not an object', () => {
    expect(errorsOf(null)).toEqual(['body']);
    expect(errorsOf([])).toEqual(['body']);
    expect(errorsOf('x')).toEqual(['body']);
  });
  it('requires district and existingRotation', () => {
    expect(errorsOf({})).toEqual(['district', 'existingRotation']);
  });
  it('rejects bad slugs and path-like input', () => {
    expect(errorsOf({ ...valid, district: '../etc/passwd' })).toEqual(['district']);
    expect(errorsOf({ ...valid, district: 'Rajshahi' })).toEqual(['district']);
  });
  it('limits the rotation to 1-3 distinct crops', () => {
    expect(errorsOf({ ...valid, existingRotation: [] })).toEqual(['existingRotation']);
    expect(errorsOf({ ...valid, existingRotation: ['aman', 'boro', 'wheat', 'jute'] })).toEqual(['existingRotation']);
    expect(errorsOf({ ...valid, existingRotation: ['aman', 'aman'] })).toEqual(['existingRotation']);
    expect(errorsOf({ ...valid, existingRotation: [1, 2] })).toEqual(['existingRotation']);
  });
  it('rejects unknown option values', () => {
    expect(errorsOf({ ...valid, irrigation: 'lots' })).toEqual(['irrigation']);
    expect(errorsOf({ ...valid, soil: { salinity: 'extreme' } })).toEqual(['soil.salinity']);
    expect(errorsOf({ ...valid, soil: { ph: 7 } })).toEqual(['soil.ph']);
  });
  it('rejects out-of-range, fractional or non-numeric priorities', () => {
    expect(errorsOf({ ...valid, priorities: { waterSaving: 4 } })).toEqual(['priorities.waterSaving']);
    expect(errorsOf({ ...valid, priorities: { waterSaving: -1 } })).toEqual(['priorities.waterSaving']);
    expect(errorsOf({ ...valid, priorities: { waterSaving: 1.5 } })).toEqual(['priorities.waterSaving']);
    expect(errorsOf({ ...valid, priorities: { waterSaving: '2' } })).toEqual(['priorities.waterSaving']);
    expect(errorsOf({ ...valid, priorities: { profit: 3 } })).toEqual(['priorities.profit']);
  });
  it('rejects unknown top-level fields (typos)', () => {
    expect(errorsOf({ ...valid, distrcit: 'x' })).toEqual(['distrcit']);
  });
  it('reports every problem at once', () => {
    expect(errorsOf({ district: 5, existingRotation: 'aman', irrigation: 'x' })).toEqual(['district', 'existingRotation', 'irrigation']);
  });
});

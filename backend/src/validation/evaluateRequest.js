// Validates and normalises the body of POST /api/evaluate.
// Strict on purpose: unknown fields are rejected so typos do not silently change the result.

import { validationError } from '../utils/errors.js';
import {
  PRIORITIES,
  PRIORITY_MIN,
  PRIORITY_MAX,
  PRIORITY_DEFAULT,
  MAX_CROPS,
  IRRIGATION_OPTIONS,
  SALINITY_OPTIONS,
  DRAINAGE_OPTIONS,
} from '../science/rules.js';

const SLUG = /^[a-z0-9-]{2,40}$/;
const TOP_LEVEL = ['district', 'existingRotation', 'soil', 'irrigation', 'priorities'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function parseEvaluateRequest(body) {
  if (!isPlainObject(body)) {
    throw validationError([{ field: 'body', message: 'Send a JSON object.' }]);
  }
  const errors = [];

  for (const key of Object.keys(body)) {
    if (!TOP_LEVEL.includes(key)) errors.push({ field: key, message: 'Unknown field.' });
  }

  if (typeof body.district !== 'string' || !SLUG.test(body.district)) {
    errors.push({ field: 'district', message: 'Required: a district slug such as "rajshahi".' });
  }

  let existing = [];
  if (!Array.isArray(body.existingRotation) || body.existingRotation.length < 1 || body.existingRotation.length > MAX_CROPS) {
    errors.push({ field: 'existingRotation', message: `Required: a list of 1 to ${MAX_CROPS} crop slugs.` });
  } else if (!body.existingRotation.every((s) => typeof s === 'string' && SLUG.test(s))) {
    errors.push({ field: 'existingRotation', message: 'Every crop must be a slug such as "aman".' });
  } else if (new Set(body.existingRotation).size !== body.existingRotation.length) {
    errors.push({ field: 'existingRotation', message: 'The same crop is listed twice.' });
  } else {
    existing = body.existingRotation;
  }

  const soilIn = body.soil ?? {};
  const soil = { salinity: 'none', drainage: 'good' };
  if (!isPlainObject(soilIn)) {
    errors.push({ field: 'soil', message: 'Must be an object.' });
  } else {
    for (const key of Object.keys(soilIn)) {
      if (!['salinity', 'drainage'].includes(key)) errors.push({ field: `soil.${key}`, message: 'Unknown field.' });
    }
    if (soilIn.salinity !== undefined) {
      if (SALINITY_OPTIONS.includes(soilIn.salinity)) soil.salinity = soilIn.salinity;
      else errors.push({ field: 'soil.salinity', message: `Must be one of: ${SALINITY_OPTIONS.join(', ')}.` });
    }
    if (soilIn.drainage !== undefined) {
      if (DRAINAGE_OPTIONS.includes(soilIn.drainage)) soil.drainage = soilIn.drainage;
      else errors.push({ field: 'soil.drainage', message: `Must be one of: ${DRAINAGE_OPTIONS.join(', ')}.` });
    }
  }

  let irrigation = 'limited';
  if (body.irrigation !== undefined) {
    if (IRRIGATION_OPTIONS.includes(body.irrigation)) irrigation = body.irrigation;
    else errors.push({ field: 'irrigation', message: `Must be one of: ${IRRIGATION_OPTIONS.join(', ')}.` });
  }

  const priorities = Object.fromEntries(PRIORITIES.map((p) => [p.key, PRIORITY_DEFAULT]));
  if (body.priorities !== undefined) {
    if (!isPlainObject(body.priorities)) {
      errors.push({ field: 'priorities', message: 'Must be an object.' });
    } else {
      for (const [key, value] of Object.entries(body.priorities)) {
        if (!PRIORITIES.some((p) => p.key === key)) {
          errors.push({ field: `priorities.${key}`, message: 'Unknown priority.' });
        } else if (!Number.isInteger(value) || value < PRIORITY_MIN || value > PRIORITY_MAX) {
          errors.push({ field: `priorities.${key}`, message: `Must be a whole number from ${PRIORITY_MIN} to ${PRIORITY_MAX}.` });
        } else {
          priorities[key] = value;
        }
      }
    }
  }

  if (errors.length) throw validationError(errors);
  return { district: body.district, existingRotation: existing, soil, irrigation, priorities };
}

import { validationError } from '../utils/errors.js';
import { BANGLADESH_BBOX, geometryBbox, isInsideBangladeshBox } from '../geo/climateGrid.js';

const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 120;
const MAX_COORDINATES = 10000;
const SUPPORTED_FIELDS = [
  'name',
  'districtId',
  'boundary',
  'soilType',
  'soilPh',
  'organicMatterPct',
  'salinityDsM',
  'irrigationSource',
];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validatePosition(position, field, errors) {
  if (!Array.isArray(position) || position.length !== 2 || !position.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    errors.push({ field, message: 'Must be a [longitude, latitude] coordinate with finite numbers.' });
    return;
  }
  if (position[0] < -180 || position[0] > 180 || position[1] < -90 || position[1] > 90) {
    errors.push({ field, message: 'Longitude must be between -180 and 180 and latitude between -90 and 90.' });
  }
}

function validateRing(ring, field, errors, count) {
  if (!Array.isArray(ring) || ring.length < 4) {
    errors.push({ field, message: 'Each linear ring must contain at least four positions.' });
    return count;
  }
  ring.forEach((position, i) => validatePosition(position, `${field}[${i}]`, errors));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Array.isArray(first) && Array.isArray(last) && (first[0] !== last[0] || first[1] !== last[1])) {
    errors.push({ field, message: 'Each linear ring must be closed.' });
  }
  return count + ring.length;
}

function validatePolygonCoordinates(coordinates, field, errors, count) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push({ field, message: 'Must contain at least one polygon.' });
    return count;
  }
  let total = count;
  for (const [i, ring] of coordinates.entries()) {
    total = validateRing(ring, `${field}[${i}]`, errors, total);
  }
  return total;
}

function validateBoundary(boundary, errors) {
  if (!isObject(boundary) || !['Polygon', 'MultiPolygon'].includes(boundary.type)) {
    errors.push({ field: 'boundary', message: 'Must be a GeoJSON Polygon or MultiPolygon.' });
    return;
  }
  const polygons = boundary.type === 'Polygon' ? [boundary.coordinates] : boundary.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) {
    errors.push({ field: 'boundary.coordinates', message: 'Must contain at least one polygon.' });
    return;
  }
  const errorsBefore = errors.length;
  let coordinateCount = 0;
  for (const [i, polygon] of polygons.entries()) {
    coordinateCount = validatePolygonCoordinates(polygon, `boundary.coordinates[${i}]`, errors, coordinateCount);
  }
  if (coordinateCount > MAX_COORDINATES) {
    errors.push({ field: 'boundary.coordinates', message: `Must contain no more than ${MAX_COORDINATES} coordinate positions.` });
  }
  // Field Shift covers Bangladesh only. Checked only when every coordinate is well formed.
  if (errors.length === errorsBefore) {
    const { minLon, maxLon, minLat, maxLat } = BANGLADESH_BBOX;
    if (!isInsideBangladeshBox(geometryBbox(boundary))) {
      errors.push({
        field: 'boundary',
        message: `Boundary must lie within Bangladesh (longitude ${minLon} to ${maxLon}, latitude ${minLat} to ${maxLat}). Check that coordinates are [longitude, latitude].`,
      });
    }
  }
}

function optionalNumber(value, field, errors, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push({ field, message: `Must be a finite number from ${min} to ${max}.` });
  }
}

function optionalText(value, field, errors) {
  if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH)) {
    errors.push({ field, message: `Must be text of at most ${MAX_TEXT_LENGTH} characters.` });
  }
}

export function parseFieldRequest(body, { partial = false } = {}) {
  if (!isObject(body)) throw validationError([{ field: 'body', message: 'Send a JSON object.' }]);
  const errors = [];
  for (const key of Object.keys(body)) {
    if (!SUPPORTED_FIELDS.includes(key)) errors.push({ field: key, message: 'Unknown field.' });
  }
  if (Object.prototype.hasOwnProperty.call(body, 'areaHa')) {
    errors.push({ field: 'areaHa', message: 'Area is calculated by the backend and must not be provided.' });
  }

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > MAX_NAME_LENGTH) {
      errors.push({ field: 'name', message: `Required: non-empty text of at most ${MAX_NAME_LENGTH} characters.` });
    }
  }
  if (!partial || body.districtId !== undefined) {
    if (!Number.isInteger(body.districtId) || body.districtId < 1) {
      errors.push({ field: 'districtId', message: 'Required: a positive integer.' });
    }
  }
  if (!partial || body.boundary !== undefined) validateBoundary(body.boundary, errors);

  optionalText(body.soilType, 'soilType', errors);
  optionalText(body.irrigationSource, 'irrigationSource', errors);
  optionalNumber(body.soilPh, 'soilPh', errors, { min: 0, max: 14 });
  optionalNumber(body.organicMatterPct, 'organicMatterPct', errors, { min: 0, max: 100 });
  optionalNumber(body.salinityDsM, 'salinityDsM', errors, { min: 0, max: 1000 });

  if (errors.length) throw validationError(errors);
  if (partial && Object.keys(body).filter((key) => SUPPORTED_FIELDS.includes(key)).length === 0) {
    throw validationError([{ field: 'body', message: 'Provide at least one field property to update.' }]);
  }
  const result = { ...body };
  if (typeof result.name === 'string') result.name = result.name.trim();
  return result;
}

export function parseFieldId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw validationError([{ field: 'id', message: 'Must be a valid UUID.' }]);
  }
  return value;
}

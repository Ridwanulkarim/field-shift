import { validationError } from '../utils/errors.js';

const ALLOWED = new Set(['crop', 'split']);
const CROP_SLUG = /^[a-z][a-z-]{0,30}$/;
const MIN_SPLIT_YEAR = 1990;

// Query: ?crop=aman&split=2013   (split is optional and defaults to the fixed PLANTING_SPLIT_YEAR)
export function parsePlantingWindowRequest(query, { now = new Date() } = {}) {
  const errors = [];
  for (const key of Object.keys(query)) {
    if (!ALLOWED.has(key)) errors.push({ field: key, message: 'Unknown query parameter.' });
  }
  const { crop, split } = query;
  if (typeof crop !== 'string' || !CROP_SLUG.test(crop)) {
    errors.push({ field: 'crop', message: 'Required. A crop slug such as "aman" (lowercase letters and hyphens).' });
  }
  let splitYear = null;
  if (split !== undefined) {
    const maxYear = now.getUTCFullYear();
    splitYear = typeof split === 'string' && /^\d{4}$/.test(split) ? Number(split) : NaN;
    if (!Number.isInteger(splitYear) || splitYear < MIN_SPLIT_YEAR || splitYear > maxYear) {
      errors.push({ field: 'split', message: `Must be a four-digit year between ${MIN_SPLIT_YEAR} and ${maxYear}.` });
    }
  }
  if (errors.length) throw validationError(errors);
  return { crop, splitYear };
}
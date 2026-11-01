import { validationError } from '../utils/errors.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_YEARS = 5;

function parseDate(value, field, errors) {
  if (typeof value !== 'string' || !DATE.test(value)) {
    errors.push({ field, message: 'Must be a date in YYYY-MM-DD format.' });
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    errors.push({ field, message: 'Must be a valid calendar date.' });
    return null;
  }
  return date;
}

export function parseDailyClimateRequest(query) {
  const errors = [];
  const from = parseDate(query.from, 'from', errors);
  const to = parseDate(query.to, 'to', errors);
  if (from && to) {
    if (from > to) errors.push({ field: 'from', message: 'Must not be later than to.' });
    const maxTo = new Date(from);
    maxTo.setUTCFullYear(maxTo.getUTCFullYear() + MAX_RANGE_YEARS);
    if (to > maxTo) errors.push({ field: 'to', message: `Date range must not exceed ${MAX_RANGE_YEARS} years.` });
  }
  if (errors.length) throw validationError(errors);
  return { from: query.from, to: query.to };
}

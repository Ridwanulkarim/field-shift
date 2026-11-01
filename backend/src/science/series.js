// Date-indexed daily series helpers (Phase 0).
//
// Why this exists: a window such as "7 days" must mean 7 CALENDAR days. Taking seven
// neighbouring array rows is only correct when no date is absent from the array. Every
// helper here walks real calendar dates and treats an absent date or a null value as
// UNKNOWN. Unknown is never zero rain and never a wet or dry day.

import { daysInMonth } from './calendar.js';

export function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toUtc(iso) {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

export function addDays(iso, n) {
  return new Date(toUtc(iso) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86400000);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Index rows by ISO date. If a date appears twice the series is invalid: fail loudly.
export function indexSeries(series) {
  const map = new Map();
  for (const row of series) {
    if (!isIsoDate(row.date)) throw new Error(`Invalid date "${row.date}" in series.`);
    if (map.has(row.date)) throw new Error(`Duplicate date ${row.date} in series.`);
    map.set(row.date, row);
  }
  return map;
}

// Value of one variable on one date: a number, or null when the date or the value is absent.
export function valueOn(index, date, field) {
  const row = index.get(date);
  if (!row) return null;
  const v = row[field];
  return isNum(v) ? v : null;
}

// Every calendar date of the cycle that STARTS in `cycleYear` for a month window
// (e.g. Nov-Mar starting 2001 runs 2001-11-01 .. 2002-03-31).
export function cycleDates(cycleYear, startMonth, endMonth) {
  const wrap = startMonth > endMonth;
  const first = `${cycleYear}-${pad(startMonth)}-01`;
  const endYear = wrap ? cycleYear + 1 : cycleYear;
  const last = `${endYear}-${pad(endMonth)}-${pad(daysInMonth(endYear, endMonth))}`;
  const out = [];
  for (let d = first; d <= last; d = addDays(d, 1)) out.push(d);
  return out;
}

// Sum of `field` over the `days` calendar days beginning at `startDate`.
// `sum` is null unless at least `minObserved` of those days have a value; the caller
// receives `observed` and `missing` so it can report why.
export function windowSum(index, startDate, days, field, minObserved = days) {
  let sum = 0;
  let observed = 0;
  for (let i = 0; i < days; i += 1) {
    const v = valueOn(index, addDays(startDate, i), field);
    if (v !== null) {
      sum += v;
      observed += 1;
    }
  }
  return { sum: observed >= minObserved ? sum : null, observed, missing: days - observed, days };
}

// Day of year on a fixed 365-day calendar: 29 February is ignored, so 1 June is day 152
// in every year. Comparing onset dates across leap and non-leap years then carries no
// one-day artefact. Dates up to 28 February are unchanged; 29 February maps to 28 February.
export function dayOfYearFixed365(iso) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const doy = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  if (!leap) return doy;
  return m > 2 ? doy - 1 : doy === 60 ? 59 : doy;
}

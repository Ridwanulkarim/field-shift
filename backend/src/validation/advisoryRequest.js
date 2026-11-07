import { validationError } from '../utils/errors.js';
import { parseMonthDay, MAX_USUAL_WINDOW_DAYS } from '../science/farmerAdvisory.js';
import { daysBetween } from '../science/series.js';
import { parsePlantingWindowRequest } from './plantingWindowRequest.js';

const ALLOWED = new Set(['crop', 'split', 'lang', 'usualFrom', 'usualTo', 'includeHeat']);
const LANGS = new Set(['en', 'bn']);

// Query: ?crop=aman&lang=bn&split=2013&usualFrom=07-15&usualTo=08-15
// lang (default en) picks which sentence goes in sentence.text; both languages are always returned.
// includeHeat=true adds growing degree days as experimental evidence (never part of the decision).
// usualFrom and usualTo (MM-DD) are the farmer's own usual transplanting window; give both or neither.
export function parseAdvisoryRequest(query, { now = new Date() } = {}) {
  const errors = [];
  for (const key of Object.keys(query)) {
    if (!ALLOWED.has(key)) errors.push({ field: key, message: 'Unknown query parameter.' });
  }
  let base = { crop: null, splitYear: null };
  try {
    const { lang, usualFrom, usualTo, includeHeat, ...rest } = query;
    base = parsePlantingWindowRequest(Object.fromEntries(Object.entries(rest).filter(([k]) => k === 'crop' || k === 'split')), { now });
  } catch (err) {
    if (err.details) errors.push(...err.details);
    else throw err;
  }
  const { lang = 'en', usualFrom, usualTo } = query;
  if (typeof lang !== 'string' || !LANGS.has(lang)) errors.push({ field: 'lang', message: 'Must be "en" or "bn".' });

  let includeHeat = false;
  if (query.includeHeat !== undefined) {
    if (query.includeHeat === 'true') includeHeat = true;
    else if (query.includeHeat !== 'false') errors.push({ field: 'includeHeat', message: 'Must be "true" or "false".' });
  }

  let usual = null;
  if ((usualFrom === undefined) !== (usualTo === undefined)) {
    errors.push({ field: usualFrom === undefined ? 'usualFrom' : 'usualTo', message: 'Give both usualFrom and usualTo, or neither.' });
  } else if (usualFrom !== undefined) {
    const a = parseMonthDay(usualFrom);
    const b = parseMonthDay(usualTo);
    if (!a) errors.push({ field: 'usualFrom', message: 'Must be a real date as MM-DD, for example 07-15 (29 February is not accepted).' });
    if (!b) errors.push({ field: 'usualTo', message: 'Must be a real date as MM-DD, for example 08-15 (29 February is not accepted).' });
    if (a && b) {
      const span = daysBetween(`2001-${usualFrom}`, `2001-${usualTo}`);
      if (span < 0) errors.push({ field: 'usualTo', message: 'Must not be earlier in the year than usualFrom.' });
      else if (span > MAX_USUAL_WINDOW_DAYS) errors.push({ field: 'usualTo', message: `The window may be at most ${MAX_USUAL_WINDOW_DAYS} days long.` });
      else usual = { from: usualFrom, to: usualTo };
    }
  }
  if (errors.length) throw validationError(errors);
  return { crop: base.crop, splitYear: base.splitYear, lang, usual, includeHeat };
}

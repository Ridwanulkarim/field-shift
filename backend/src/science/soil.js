// Soil helpers. Pure functions.
import { SALINITY_LEVEL } from './rules.js';

// Salinity class from electrical conductivity (dS/m). The class boundaries (2, 4, 8) are common
// general-purpose cut points, not a Bangladeshi standard; the numeric value is always reported too.
export function salinityClassFromDsM(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value < 2) return 'none';
  if (value < 4) return 'slight';
  if (value < 8) return 'moderate';
  return 'high';
}

// Compares a salinity class with a crop's tolerance (1 sensitive ... 5 tolerant, from the UNVERIFIED crop table).
// 'unknown' when no salinity was entered; never guessed.
export function salinityCompatibility(salinityClass, crop) {
  if (salinityClass === null || salinityClass === undefined) return 'unknown';
  return SALINITY_LEVEL[salinityClass] > crop.salinityTolerance ? 'exceeds_tolerance' : 'within_tolerance';
}

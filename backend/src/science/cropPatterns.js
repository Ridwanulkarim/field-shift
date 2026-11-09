// Agronomic plausibility from documented cropping patterns. Pure functions.
//
// A rotation is "documented" when its crops are a subset of one pattern in croppingPatterns.json (leaving a season fallow is
// always possible). "Documented" means: reported in a BRRI/BARI survey or field trial for some region. It does NOT mean
// recommended for a given farm, and it says nothing about yield or profit. The file itself is still marked
// SECONDARY_READING_NOT_AGRONOMIST_VERIFIED: a person must confirm each row against its paper before it is called BRRI-documented.

import patternFile from '../data/reference/croppingPatterns.json' with { type: 'json' };

export const PATTERN_STATUS = patternFile.status;
export const PATTERN_STATUS_NOTE = patternFile.statusNote;

export function matchingPatterns(slugs, file = patternFile) {
  const wanted = new Set(slugs);
  return file.patterns
    .filter((p) => [...wanted].every((s) => p.crops.includes(s)))
    .map((p) => ({ id: p.id, label: p.label, sources: p.sources.map((x) => x.id) }));
}

export function patternInfo(slugs, file = patternFile) {
  const matches = matchingPatterns(slugs, file);
  return {
    documented: matches.length > 0,
    matches,
    status: file.status,
    sourceIds: [...new Set(matches.flatMap((m) => m.sources))],
  };
}

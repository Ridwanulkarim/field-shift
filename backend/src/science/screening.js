// Screening of many district x crop advisories at once, with a correction for testing many things together.
// Pure functions: no database, no HTTP. The script scripts/screen-advisory.js feeds them real advisory responses.
//
// WHY A CORRECTION: each advisory is a separate test at p < 0.05. Run 24 of them on pure noise and one or two will look
// "significant" by chance. The Holm step-down correction controls the chance of ANY false alarm across the whole family.
// Two rows that rest on the same stored data (neighbouring districts that share a NASA grid cell) are one test, not two.
// This is an exploratory table for deciding what to look at, not a result.

export const ALPHA = 0.05;

// Holm-Bonferroni adjusted p-values. Input: array of numbers (null/undefined are skipped and returned as null).
export function holmAdjust(pValues) {
  const idx = pValues.map((p, i) => ({ p, i })).filter((x) => Number.isFinite(x.p)).sort((a, b) => a.p - b.p);
  const m = idx.length;
  const out = pValues.map(() => null);
  let running = 0;
  idx.forEach(({ p, i }, k) => {
    running = Math.max(running, Math.min(1, (m - k) * p));
    out[i] = running;
  });
  return out;
}

// One flat row from an advisory response.
export function screenRow(advisory) {
  const ev = advisory.evidence;
  const s = ev.strength;
  const b = s?.startBoundary;
  return {
    district: advisory.district.slug,
    crop: advisory.crop.slug,
    runId: advisory.provenance.runId,
    sharedWith: advisory.district.sharedGridCellWith ?? [],
    action: advisory.decision.action,
    confidence: advisory.decision.confidence,
    shiftDays: advisory.decision.shiftDays,
    earlyMedianDate: ev.onsetDates?.earlyMedian ?? null,
    lateMedianDate: ev.onsetDates?.lateMedian ?? null,
    estimateDays: s?.shiftEstimate?.estimateDays ?? null,
    interval95Days: s?.shiftEstimate?.interval95Days ?? null,
    pValue: s?.pValue ?? null,
    definitionsAgreeing: s?.definitionsAgreeing ?? null,
    definitionsUsable: s?.definitionsUsable ?? null,
    earlyAtStartShare: b?.earlyShareAtFirstDay ?? null,
    lateAtStartShare: b?.lateShareAtFirstDay ?? null,
    saturated: b?.saturated ?? null,
    earlyYears: ev.periods.early.years,
    lateYears: ev.periods.late.years,
    excludedYears: ev.excludedYears.length,
    dataEndDate: advisory.latestObservationDate ?? null,
  };
}

// rows: screenRow() results (plus { district, crop, notIngested: true } placeholders for districts without real data).
export function summarizeScreen(rows) {
  // One test per distinct stored run and crop; a second district on the same data adds no information.
  const seen = new Map();
  const tested = rows.map((r) => {
    if (r.notIngested || r.pValue === null) return { ...r, familyRole: r.notIngested ? 'no_data' : 'no_test' };
    const key = `${r.runId}:${r.crop}`;
    if (seen.has(key)) return { ...r, familyRole: 'same_data_as', sameDataAs: seen.get(key) };
    seen.set(key, `${r.district}/${r.crop}`);
    return { ...r, familyRole: 'tested' };
  });
  const family = tested.filter((r) => r.familyRole === 'tested');
  const adj = holmAdjust(family.map((r) => r.pValue));
  family.forEach((r, i) => { r.holmPValue = adj[i]; });
  const flagged = tested.map((r) => {
    if (r.familyRole === 'no_data') return { ...r, verdict: 'not_ingested' };
    if (r.familyRole === 'same_data_as') return { ...r, verdict: 'same_data_as_another_row' };
    if (r.familyRole === 'no_test') return { ...r, verdict: r.action === 'none' && r.confidence === 'not_applicable' ? 'not_applicable' : 'not_enough_data' };
    const supported = r.action === 'delay' || r.action === 'advance';
    let verdict;
    if (supported) verdict = r.holmPValue < ALPHA ? 'supported_after_correction' : 'supported_but_may_be_chance';
    else if (r.confidence === 'weak') verdict = 'weak_not_reliable';
    else verdict = 'no_distinguishable_shift';
    return { ...r, verdict };
  });
  const rawSignificant = family.filter((r) => r.pValue < ALPHA).length;
  return {
    rows: flagged,
    familySize: family.length,
    alpha: ALPHA,
    expectedFalseAlarmsIfNoRealChange: Math.round(family.length * ALPHA * 100) / 100,
    rawSignificant,
    survivingCorrection: family.filter((r) => r.holmPValue < ALPHA).length,
    caveats: [
      `${family.length} separate tests were run. Even if nothing had changed anywhere, about ${Math.round(family.length * ALPHA * 100) / 100} would look significant at p < 0.05 by chance.`,
      'The Holm correction is applied across all tests shown. Aus and Aman in one district are related, so the correction is slightly conservative.',
      'Districts that share a NASA grid cell use identical data and count once.',
      'A supported result still describes the start of usable rain under one heuristic definition from one modelled source; it is not proof of climate change and not a planting recommendation for a farm.',
    ],
  };
}

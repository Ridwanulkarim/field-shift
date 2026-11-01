function daysSince(date, now = new Date()) {
  const observed = new Date(`${date}T00:00:00Z`);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.floor((today - observed) / 86400000));
}

export function makeDataLabel(provenance, { coverageStart = null, coverageEnd = null } = {}) {
  const isSynthetic = Boolean(provenance?.isSynthetic);
  return {
    kind: isSynthetic ? 'synthetic' : 'nasa_stored',
    source: provenance?.source ?? null,
    retrievedAt: provenance?.retrievedAt ?? null,
    coverageStart,
    coverageEnd,
    isSynthetic,
  };
}

export function freshnessFor(provenance) {
  const latestObservationDate = provenance?.endDate ?? null;
  return {
    latestObservationDate,
    daysSinceLatest: latestObservationDate ? daysSince(latestObservationDate) : null,
  };
}

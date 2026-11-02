// Decides whether every district is backed by real, reasonably fresh NASA POWER data.
// Pure function: the verify script feeds it the output of repository.listDistricts().

// Refresh ends 7 days behind today by default, so a healthy dataset is normally 7-9 days old.
// 21 days leaves room for two missed daily runs plus NASA publication delays.
export const DEFAULT_MAX_AGE_DAYS = 21;

function ageInDays(isoDateString, now) {
  const observed = new Date(`${isoDateString}T00:00:00Z`);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.floor((today - observed) / 86400000));
}

export function checkLiveData(districts, { maxAgeDays = DEFAULT_MAX_AGE_DAYS, now = new Date() } = {}) {
  const problems = [];
  const rows = districts.map((d) => {
    const ageDays = d.latestObservationDate ? ageInDays(d.latestObservationDate, now) : null;
    let state = 'ok';
    if (d.climateData === 'none') state = 'no_data';
    else if (d.climateData === 'synthetic') state = 'synthetic_only';
    else if (ageDays !== null && ageDays > maxAgeDays) state = 'stale';
    if (state !== 'ok') problems.push(`${d.slug}: ${state}${ageDays !== null ? ` (latest observation ${ageDays} days old)` : ''}`);
    return { slug: d.slug, state, latestObservationDate: d.latestObservationDate, ageDays };
  });
  return { ok: problems.length === 0 && rows.length > 0, rows, problems };
}

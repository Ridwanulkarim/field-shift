// Small, dependency-free statistics helpers. All of them ignore null/NaN values
// instead of treating them as zero, because a missing observation is not a zero.

export function mean(values) {
  const clean = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

export function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// Ordinary least squares y = intercept + slope * x.
// Returns null when a line cannot be fitted (fewer than 3 points, or all x equal).
export function linearRegression(points) {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rss = pts.reduce((a, p) => a + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const r2 = syy === 0 ? 0 : 1 - rss / syy;
  const se = Math.sqrt(rss / (n - 2) / sxx);
  // se === 0 means a perfect straight line: the t statistic is infinite, reported as null.
  const tStat = se === 0 ? (slope === 0 ? 0 : null) : slope / se;
  return { n, slope, intercept, r2, tStat, perfectFit: se === 0 && slope !== 0 };
}

// Summarise a yearly series [{year, value}] as a trend.
// This is a descriptive tool: a rough t-statistic with |t| >= 2 is used only as a hint that
// the slope is "distinguishable from noise". It is not a formal significance test and the
// series are short, so the wording in the API always says "indicative".
export function trendSummary(yearly, { perYears = 10, minYears = 10 } = {}) {
  const pts = yearly
    .filter((p) => typeof p.value === 'number' && Number.isFinite(p.value))
    .sort((a, b) => a.year - b.year);
  const n = pts.length;
  if (n === 0) {
    return { n: 0, verdict: 'insufficient_data' };
  }
  const values = pts.map((p) => p.value);
  const half = Math.min(10, Math.floor(n / 2));
  const base = {
    n,
    firstYear: pts[0].year,
    lastYear: pts[n - 1].year,
    mean: round(mean(values)),
    earlyMean: half > 0 ? round(mean(values.slice(0, half))) : null,
    recentMean: half > 0 ? round(mean(values.slice(n - half))) : null,
    windowYears: half,
  };
  if (n < minYears) return { ...base, verdict: 'insufficient_data' };
  const fit = linearRegression(pts.map((p) => ({ x: p.year, y: p.value })));
  if (!fit) return { ...base, verdict: 'insufficient_data' };
  const distinguishable = fit.perfectFit || (fit.tStat !== null && Math.abs(fit.tStat) >= 2);
  return {
    ...base,
    slopePerDecade: round(fit.slope * perYears, 3),
    r2: round(fit.r2, 3),
    tStat: fit.tStat === null ? null : round(fit.tStat, 2),
    verdict: distinguishable ? 'distinguishable_from_noise' : 'not_distinguishable_from_noise',
  };
}

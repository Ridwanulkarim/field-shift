// Distribution-free comparison of onset dates. This module has no database or CLI concerns.

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function combinations(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i += 1) result = (result * (n - k + i)) / i;
  return result;
}

function normalTwoSidedP(z) {
  return Math.erfc ? Math.erfc(Math.abs(z) / Math.sqrt(2)) : 2 * (1 - normalCdf(Math.abs(z)));
}

function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * value);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - polynomial * Math.exp(-value * value);
  return 0.5 * (1 + sign * erf);
}

function rankValues(values) {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  let i = 0;
  const tieGroups = [];
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].value === sorted[i].value) j += 1;
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) ranks[sorted[k].index] = rank;
    tieGroups.push(j - i);
    i = j;
  }
  return { ranks, tieGroups };
}

function exactPValue(u, n, m) {
  const distribution = Array.from({ length: n * m + 1 }, () => 0);
  const dp = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => []));
  for (let i = 0; i <= n; i += 1) for (let j = 0; j <= m; j += 1) dp[i][j] = Array(i * j + 1).fill(0);
  dp[0][0][0] = 1;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (i === 0 && j === 0) continue;
      for (let value = 0; value <= i * j; value += 1) {
        dp[i][j][value] = (i > 0 && value >= j ? dp[i - 1][j][value - j] || 0 : 0)
          + (j > 0 ? dp[i][j - 1][value] || 0 : 0);
      }
    }
  }
  for (let value = 0; value <= n * m; value += 1) distribution[value] = dp[n][m][value];
  const observed = Math.round(u);
  const totalWays = combinations(n + m, n);
  const lower = distribution.slice(0, observed + 1).reduce((sum, count) => sum + count, 0) / totalWays;
  const upper = distribution.slice(observed).reduce((sum, count) => sum + count, 0) / totalWays;
  return Math.min(1, 2 * Math.min(lower, upper));
}

// Mann-Whitney U with scipy-compatible U1 (the first sample's statistic).
// Exact p-values are used only without ties and for manageable sample sizes.
export function mannWhitney(x, y, { exactLimit = 200000 } = {}) {
  const first = x.filter(isNumber);
  const second = y.filter(isNumber);
  if (!first.length || !second.length) return null;
  const { ranks, tieGroups } = rankValues([...first, ...second]);
  const n = first.length;
  const m = second.length;
  const u1 = ranks.slice(0, n).reduce((sum, rank) => sum + rank, 0) - (n * (n + 1)) / 2;
  const hasTies = tieGroups.some((size) => size > 1);
  const totalWays = combinations(n + m, n);
  const exact = !hasTies && totalWays <= exactLimit;
  let pValue;
  let method;
  if (exact) {
    pValue = exactPValue(u1, n, m);
    method = 'exact';
  } else {
    const tieCorrection = tieGroups.reduce((sum, size) => sum + size ** 3 - size, 0);
    const variance = (n * m / 12) * (n + m + 1 - tieCorrection / ((n + m) * (n + m - 1)));
    const meanU = (n * m) / 2;
    const continuity = u1 === meanU ? 0 : u1 < meanU ? 0.5 : -0.5;
    const z = (u1 - meanU + continuity) / Math.sqrt(variance);
    pValue = normalTwoSidedP(z);
    method = 'asymptotic';
  }
  return { n, m, u1, pValue, method, hasTies };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Compare the first and second halves of a yearly onset series.
export function analyzeOnsetShift(yearly, {
  splitYear = null,
  alpha = 0.05,
  minYearsPerPeriod = 3,
  minShiftDays = 1,
} = {}) {
  const points = yearly
    .filter((point) => Number.isInteger(point.year) && isNumber(point.value))
    .sort((a, b) => a.year - b.year);
  const split = splitYear ?? (points.length ? points[Math.floor(points.length / 2)].year : null);
  const early = points.filter((point) => point.year < split).map((point) => point.value);
  const late = points.filter((point) => point.year >= split).map((point) => point.value);
  const base = {
    splitYear: split,
    earlyYears: early.length,
    lateYears: late.length,
    earlyMedian: early.length ? median(early) : null,
    lateMedian: late.length ? median(late) : null,
    shiftDays: early.length && late.length ? median(late) - median(early) : null,
  };
  if (early.length < minYearsPerPeriod || late.length < minYearsPerPeriod) {
    return { ...base, test: null, verdict: 'insufficient_data' };
  }
  const test = mannWhitney(early, late);
  const meaningful = Math.abs(base.shiftDays) >= minShiftDays && test.pValue < alpha;
  return {
    ...base,
    test,
    verdict: meaningful ? (base.shiftDays > 0 ? 'later_onset' : 'earlier_onset') : 'no_distinguishable_shift',
  };
}

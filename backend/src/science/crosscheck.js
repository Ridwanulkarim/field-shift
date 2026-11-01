// Per-year May rain statistics from any daily source, so two sources can be compared the same way.
// `rainOn(isoDate)` returns mm or null (unknown). Pure: no database, no network.
import { addDays } from './series.js';

export function mayStats(rainOn, years) {
  return years.map((year) => {
    const sum = (start, days) => {
      let total = 0;
      for (let i = 0; i < days; i += 1) {
        const v = rainOn(addDays(start, i));
        if (v === null || v === undefined) return null;
        total += v;
      }
      return total;
    };
    let wettest = null;
    for (let d = `${year}-05-01`; d <= `${year}-05-25`; d = addDays(d, 1)) {
      const w = sum(d, 7);
      if (w !== null && (wettest === null || w > wettest)) wettest = w;
    }
    return { year, firstWeek: sum(`${year}-05-01`, 7), may: sum(`${year}-05-01`, 31), wettest7: wettest };
  });
}

export function mean(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function pearson(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 3) return null;
  const mx = mean(pairs.map((p) => p[0]));
  const my = mean(pairs.map((p) => p[1]));
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

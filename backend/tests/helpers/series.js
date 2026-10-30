// TEST FIXTURES ONLY. Hand-built daily series used to check the arithmetic of the science
// code against answers we can compute by hand. They are not NASA data and not realistic.

export function isoDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

// Build a daily series from firstYear to lastYear (inclusive).
// `fn(year, month, day)` returns { precipMm, tMaxC, tMinC } (use null for missing).
export function buildSeries(firstYear, lastYear, fn) {
  const out = [];
  const start = Date.UTC(firstYear, 0, 1);
  const end = Date.UTC(lastYear, 11, 31);
  for (let t = start; t <= end; t += 86400000) {
    const dt = new Date(t);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const v = fn(y, m, d);
    out.push({ date: isoDate(y, m, d), precipMm: v.precipMm, tMaxC: v.tMaxC, tMinC: v.tMinC ?? null });
  }
  return out;
}

// Constant rain/temperature each day, optionally different per month via a function.
export const flat = (precipMm, tMaxC) => () => ({ precipMm, tMaxC, tMinC: 20 });

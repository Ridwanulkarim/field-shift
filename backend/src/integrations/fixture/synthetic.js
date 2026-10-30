// SYNTHETIC climate generator, for demonstrations and offline demos only.
//
// The numbers are produced by a small random model with fixed seasonality and NO trend. They
// are NOT NASA observations and have no climatic meaning: they must never be quoted as findings.
// Every row of this data is stored under a dataset run with isSynthetic = true, and the API
// and the user interface label it as synthetic.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Rough, invented monthly shape (cool winter, hot pre-monsoon, wet monsoon). Not climatology.
const MEAN_TMAX_C = [25, 28, 32, 34, 33.5, 32, 31.5, 32, 32, 31.5, 29, 26];
const RAIN_DAY_PROBABILITY = [0.03, 0.05, 0.08, 0.2, 0.4, 0.65, 0.8, 0.75, 0.65, 0.35, 0.08, 0.02];
const MEAN_MM_PER_RAIN_DAY = [4, 6, 8, 12, 15, 20, 22, 20, 18, 16, 8, 4];

export function generateSyntheticSeries({ startYear, endYear, seed }) {
  const rand = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const days = [];
  for (let t = Date.UTC(startYear, 0, 1); t <= Date.UTC(endYear, 11, 31); t += 86400000) {
    const dt = new Date(t);
    const month = dt.getUTCMonth();
    const tMax = MEAN_TMAX_C[month] + gauss() * 1.8;
    const tMin = tMax - (5 + 3 * rand());
    const rains = rand() < RAIN_DAY_PROBABILITY[month];
    const precip = rains ? -Math.log(Math.max(rand(), 1e-9)) * MEAN_MM_PER_RAIN_DAY[month] : 0;
    days.push({
      date: dt.toISOString().slice(0, 10),
      precipMm: Math.round(precip * 10) / 10,
      tMaxC: Math.round(tMax * 10) / 10,
      tMinC: Math.round(tMin * 10) / 10,
    });
  }
  return days;
}

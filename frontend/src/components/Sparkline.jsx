// A tiny line chart (inline SVG, no library) for a yearly series.
export default function Sparkline({ points, label }) {
  const values = points.map((p) => p.value).filter((v) => v !== null && Number.isFinite(v));
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 40;
  const pad = 3;
  const coords = points
    .map((p, i) => {
      if (p.value === null || !Number.isFinite(p.value)) return null;
      const x = pad + (i / (points.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((p.value - min) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean);
  const first = points[0].year;
  const last = points[points.length - 1].year;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-40 shrink-0" role="img" aria-label={`${label}, ${first} to ${last}, range ${min} to ${max}`}>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords.join(' ')} />
    </svg>
  );
}

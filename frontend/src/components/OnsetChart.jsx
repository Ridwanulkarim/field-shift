// Two strip plots of the day usable rain started, one dot per year: early years vs late years.
// Input is evidence.distributions from GET /api/districts/:slug/advisory (days are of a 365-day year, 1 Jan = 1).
// Years with no usable rain by the end of the search season are NOT plotted (their onset is unknown, not a day);
// the caller shows how many there are. Pure SVG, no chart library.

const W = 420; // narrow on purpose: text stays readable when the SVG is scaled to a phone width
const PAD = 14;
const ROW_H = 112;
const TOP = 26;
const DOT_R = 3.5;
const DOT_STEP = 8.5;
const MAX_STACK = 7;

const dayToDate = (day, locale) =>
  new Date(Date.UTC(2001, 0, Math.round(day))).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function ticksFor(lo, hi) {
  // 1st and 15th of each month inside the domain.
  const out = [];
  for (let m = 0; m < 12; m += 1) {
    for (const d of [1, 15]) {
      const day = Math.round((Date.UTC(2001, m, d) - Date.UTC(2001, 0, 1)) / 864e5) + 1;
      if (day >= lo && day <= hi) out.push(day);
    }
  }
  // Keep the axis readable on a phone: at most about 4 labels.
  const step = Math.ceil(out.length / 4) || 1;
  return out.filter((_, i) => i % step === 0);
}

export default function OnsetChart({ distributions, labels, locale, numberLocale }) {
  const groups = [
    { key: "early", color: "#64748b", label: labels.early },
    { key: "late", color: "#15803d", label: labels.late },
  ].filter((g) => distributions?.[g.key]);

  const all = groups.flatMap((g) => distributions[g.key].valuesDayOfYear ?? []);
  if (!groups.length || all.length === 0) return null;

  const lo = Math.min(...all) - 5;
  const hi = Math.max(...all) + 5;
  const x = (v) => PAD + ((v - lo) / (hi - lo)) * (W - PAD * 2);
  const axisY = TOP + ROW_H * groups.length - 14;
  const height = axisY + 36;
  const nf = (n) => Number(n).toLocaleString(numberLocale);

  const description = groups
    .map((g) => {
      const d = distributions[g.key];
      return `${g.label}: ${labels.median} ${d.summary?.median != null ? dayToDate(d.summary.median, locale) : "—"}`;
    })
    .join("; ");

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${labels.chartTitle}. ${description}`}
    >
      {ticksFor(lo, hi).map((day) => (
        <g key={day}>
          <line x1={x(day)} x2={x(day)} y1={TOP - 6} y2={axisY} stroke="#e2e8f0" />
          <text x={x(day)} y={axisY + 16} textAnchor="middle" fontSize="13" fill="#475569">
            {dayToDate(day, locale)}
          </text>
        </g>
      ))}
      <line x1={PAD} x2={W - PAD} y1={axisY} y2={axisY} stroke="#94a3b8" />

      {groups.map((g, r) => {
        const d = distributions[g.key];
        const s = d.summary ?? {};
        const top = TOP + r * ROW_H;
        const base = top + 86;
        const counts = new Map();
        (d.valuesDayOfYear ?? []).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
        return (
          <g key={g.key}>
            <text x={PAD} y={top} fontSize="14" fontWeight="600" fill="#0f172a">
              {g.label}
              {s.median != null ? ` · ${labels.median} ${dayToDate(s.median, locale)}` : ""}
            </text>
            {s.q1 != null && s.q3 != null && (
              <rect
                x={x(s.q1)}
                y={top + 10}
                width={Math.max(2, x(s.q3) - x(s.q1))}
                height={base - top - 4}
                fill={g.color}
                opacity="0.12"
                rx="3"
              />
            )}
            {s.median != null && (
              <line
                x1={x(s.median)}
                x2={x(s.median)}
                y1={top + 10}
                y2={base + 4}
                stroke={g.color}
                strokeWidth="2"
                strokeDasharray="5 3"
              />
            )}
            {[...counts.entries()].map(([v, c]) => (
              <g key={v}>
                {Array.from({ length: Math.min(c, MAX_STACK) }, (_, k) => (
                  <circle key={k} cx={x(v)} cy={base - k * DOT_STEP} r={DOT_R} fill={g.color} stroke="#fff" strokeWidth="1" />
                ))}
                {c > MAX_STACK && (
                  <text x={x(v) + DOT_R + 3} y={base - MAX_STACK * DOT_STEP + 6} fontSize="12" fill="#334155">
                    ×{nf(c)}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

import React, { useState } from 'react';

/**
 * RotationCard Component (Spec Section 46, 49, 50, 54)
 * Displays seasonal crop sequence, overall score circular gauge, component score breakdown,
 * feasibility validation, and expandable Section 49 Agronomic Traceability Drawer.
 * 
 * STRICT COMPLIANCE:
 * - Spec Section 50: NEVER uses "Best rotation". Strictly uses "Highest-scoring rotation".
 */
export default function RotationCard({
  rotation,
  rank = 1,
  isTopCandidate = false,
  onSelect
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!rotation) return null;

  const score = rotation.overall_score != null ? Math.round(rotation.overall_score * 10) / 10 : 0;
  const isFeasible = rotation.feasibility_status === 'Seasonally feasible';

  // Circular gauge styling based on score tiers
  const getScoreTheme = (val) => {
    if (val >= 75) return { color: '#34d399', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' };
    if (val >= 50) return { color: '#fbbf24', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' };
    if (val >= 25) return { color: '#fb923c', bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' };
    return { color: '#f87171', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' };
  };

  const theme = getScoreTheme(score);
  const strokeDashoffset = 251.2 - (251.2 * score) / 100;

  // Components breakdown with flexible fallbacks for both single evaluation and comparison cards
  const components = [
    { name: 'Water Resilience', score: rotation.water_score ?? rotation.component_scores?.water_score, weight: rotation.weights?.effective_water_weight ?? rotation.effective_weights?.water ?? rotation.effective_water_weight, icon: '💧', color: 'bg-cyan-400' },
    { name: 'Heat Tolerance', score: rotation.heat_score ?? rotation.component_scores?.heat_score, weight: rotation.weights?.effective_heat_weight ?? rotation.effective_weights?.heat ?? rotation.effective_heat_weight, icon: '🔥', color: 'bg-amber-400' },
    { name: 'Soil Health', score: rotation.soil_score ?? rotation.component_scores?.soil_score, weight: rotation.weights?.effective_soil_weight ?? rotation.effective_soil_weight, icon: '🌿', color: 'bg-emerald-400' },
    { name: 'Crop Diversity', score: rotation.diversity_score ?? rotation.component_scores?.diversity_score, weight: rotation.weights?.effective_diversity_weight ?? rotation.effective_diversity_weight, icon: '🔄', color: 'bg-teal-400' },
    { name: 'Market Profitability', score: rotation.profitability_score ?? rotation.component_scores?.profitability_score, weight: rotation.weights?.effective_profitability_weight ?? rotation.effective_profitability_weight, icon: '💰', color: 'bg-emerald-300' }
  ];

  // Sequence items
  const sequence = rotation.sequence || (
    Array.isArray(rotation.crops) && Array.isArray(rotation.season_sequence)
      ? rotation.crops.map((c, i) => ({
          season: rotation.season_sequence[i] || `Season ${i + 1}`,
          crop_name: c.name || c.crop_name,
          crop_family: c.crop_family || c.family,
          duration_days: c.growing_days
        }))
      : []
  );

  return (
    <div className={`bg-[#0a1c2e]/90 border rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/35 backdrop-blur-md transition-all ${
      isTopCandidate ? 'border-sky-400/60 ring-2 ring-sky-500/40 shadow-sky-500/10' : 'border-sky-500/25'
    }`}>
      {/* Top Header: Rank & Feasibility */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-sky-800/40">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Spec Section 50: Strictly "Highest-scoring rotation", NEVER "Best rotation" */}
          {isTopCandidate ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              🏆 Highest-scoring rotation
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#071626] text-sky-300 border border-sky-800/60">
              Rank #{rank} Candidate
            </span>
          )}

          {rotation.label && (
            <span className="text-sm font-bold text-white tracking-tight">
              {rotation.label}
            </span>
          )}
        </div>

        {/* Feasibility Pill */}
        <div>
          {isFeasible ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Seasonally Feasible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40" title={rotation.infeasibility_reason}>
              <span>⚠</span> Not Seasonally Feasible
            </span>
          )}
        </div>
      </div>

      {/* Main Body: Sequence & Score Circular Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-6">
        {/* Left: Seasonal Crop Flow */}
        <div className="md:col-span-8 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block mb-2">
            Seasonal Crop Progression ({sequence.length} Seasons)
          </span>

          <div className="flex flex-wrap items-center gap-2.5">
            {sequence.map((item, idx) => (
              <React.Fragment key={idx}>
                <div className="bg-[#071626]/90 border border-sky-800/60 rounded-xl p-3 shadow-sm min-w-[140px] flex-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-sky-400/80 mb-1">
                    <span>{item.season}</span>
                    {item.duration_days && <span>{item.duration_days}d</span>}
                  </div>
                  <div className="text-sm font-extrabold text-white truncate" title={item.crop_name || item.name}>
                    {item.crop_name || item.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {item.crop_family || item.family}
                  </div>
                </div>

                {idx < sequence.length - 1 && (
                  <div className="text-sky-400/70 font-black text-lg px-1 select-none">
                    →
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {!isFeasible && rotation.infeasibility_reason && (
            <div className="bg-rose-950/60 border border-rose-800/80 rounded-xl p-3 text-xs text-rose-200 mt-2">
              <strong>Seasonal Feasibility Warning:</strong> {rotation.infeasibility_reason}
            </div>
          )}
        </div>

        {/* Right: Circular Score Gauge */}
        <div className="md:col-span-4 flex flex-col items-center justify-center bg-[#071626]/60 border border-sky-800/40 rounded-2xl p-4">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#06111F"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={theme.color}
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-white leading-none tabular-nums">
                {score}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                / 100 pts
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-sky-200 mt-2 text-center">
            Overall Rotation Score
          </span>
        </div>
      </div>

      {/* Component Breakdown Bars */}
      <div className="space-y-2.5 mb-5 pt-4 border-t border-sky-800/30">
        <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block mb-1">
          Component Scores & Effective NASA Weightings
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {components.map((comp) => {
            const hasScore = comp.score != null;
            const val = hasScore ? Math.round(comp.score * 10) / 10 : 0;
            return (
              <div key={comp.name} className="bg-[#071626]/85 border border-sky-800/40 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1 text-slate-200 font-medium">
                    <span>{comp.icon}</span> {comp.name}
                  </span>
                  <span className="font-extrabold text-white font-mono">
                    {hasScore ? val : 'N/A'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#040e1a] rounded-full h-1.5 overflow-hidden mb-1.5">
                  <div
                    className={`h-full ${comp.color} rounded-full transition-all duration-500`}
                    style={{ width: `${hasScore ? Math.min(100, Math.max(0, val)) : 0}%` }}
                  ></div>
                </div>
                {comp.weight != null && (
                  <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>Eff. Wt:</span>
                    <span className="text-sky-300 font-bold">{Number(comp.weight).toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Section 49 Traceability Drawer Toggle */}
      <div className="pt-3 border-t border-sky-800/40">
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#071626] hover:bg-[#0c2339] border border-sky-800/50 text-xs font-semibold text-sky-200 transition-all shadow-sm cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <span>🔍</span>
            <span>Spec Section 49 Agronomic Traceability & Audit Trail</span>
          </span>
          <span className="text-sky-400 font-bold font-mono">
            {isDrawerOpen ? '▲ Hide Details' : '▼ View 8 Sub-Objects'}
          </span>
        </button>

        {/* Drawer Content */}
        {isDrawerOpen && rotation.explanation && (
          <div className="mt-3 bg-[#040e1a] border border-sky-800/60 rounded-xl p-5 text-xs space-y-4 shadow-inner">
            <div className="flex items-center justify-between pb-3 border-b border-sky-800/40">
              <span className="font-bold text-white text-sm">Decision-Support Agronomic Audit Trail</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                Scoring Engine: v6.2
              </span>
            </div>

            {/* Sub-object 1: Water */}
            <div className="space-y-1">
              <strong className="text-cyan-300 block font-bold">1. Water Resilience Rationale:</strong>
              <p className="text-slate-300 leading-relaxed pl-3 border-l-2 border-cyan-500/40">
                {rotation.explanation.water?.rationale || 'Evaluated based on crop water demands and NASA satellite soil moisture/rainfall deficit.'}
              </p>
            </div>

            {/* Sub-object 2: Heat */}
            <div className="space-y-1">
              <strong className="text-amber-300 block font-bold">2. Thermal Tolerance Rationale:</strong>
              <p className="text-slate-300 leading-relaxed pl-3 border-l-2 border-amber-500/40">
                {rotation.explanation.heat?.rationale || 'Evaluated against MODIS land surface temperatures and hot-day frequencies.'}
              </p>
            </div>

            {/* Sub-object 3: Soil */}
            <div className="space-y-1">
              <strong className="text-emerald-300 block font-bold">3. Soil Health & Penalty Breakdown:</strong>
              <div className="text-slate-300 pl-3 border-l-2 border-emerald-500/40 space-y-1">
                <div>Base soil health benefit: <strong className="text-white">{rotation.explanation.soil?.base_soil_health_score} pts</strong></div>
                <div>Drainage penalty (3x3 matrix): <strong className="text-rose-300">-{Math.abs(rotation.explanation.soil?.drainage_penalty || 0)} pts</strong></div>
                <div>Soil pH penalty (linear distance): <strong className="text-rose-300">-{Math.abs(rotation.explanation.soil?.ph_penalty || 0)} pts</strong></div>
                <div>Final soil score: <strong className="text-white">{rotation.explanation.soil?.final_soil_score} pts</strong></div>
              </div>
            </div>

            {/* Sub-object 4: Diversity */}
            <div className="space-y-1">
              <strong className="text-teal-300 block font-bold">4. Crop Diversity & Rotation Sequence:</strong>
              <div className="text-slate-300 pl-3 border-l-2 border-teal-500/40 space-y-1">
                <div>Candidate crop families: <code className="bg-[#071626] px-1.5 py-0.5 rounded text-white font-mono text-[11px]">{JSON.stringify(rotation.explanation.diversity?.candidate_crop_families || [])}</code></div>
                <div>Repeat check sequence: <code className="bg-[#071626] px-1.5 py-0.5 rounded text-white font-mono text-[11px]">{JSON.stringify(rotation.explanation.diversity?.repeat_check_sequence || [])}</code></div>
                <div>Repeat penalty: <strong className="text-rose-300">-{rotation.explanation.diversity?.repeat_penalty || 0} pts</strong> (Final diversity: {rotation.explanation.diversity?.final_diversity_score})</div>
              </div>
            </div>

            {/* Sub-object 5: Scientific Caveats */}
            <div className="pt-2 border-t border-sky-800/40">
              <strong className="text-sky-400 block font-bold mb-1">Spec Section 56 Mandatory Disclosures:</strong>
              <ul className="list-disc list-inside text-slate-400 text-[11px] space-y-1">
                {rotation.explanation.caveats?.map((c, i) => (
                  <li key={i}>{c}</li>
                )) || (
                  <>
                    <li>Not a forecast: Recent NASA conditions represent current climate pressures, not predictive forecasts.</li>
                    <li>Flood risk: Direct inundation modeling is outside the MVP scope.</li>
                    <li>Simplified season windows: Calendar approximations based on canonical BARI guidelines.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

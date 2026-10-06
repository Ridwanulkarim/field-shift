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
  compact = false,
  onSelect
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!rotation) return null;

  const explanation = typeof rotation.explanation === 'string'
    ? (() => { try { return JSON.parse(rotation.explanation); } catch { return null; } })()
    : (rotation.explanation || null);

  const caveatsList = Array.isArray(explanation?.caveats)
    ? explanation.caveats
    : (explanation?.caveats && typeof explanation.caveats === 'object')
      ? Object.entries(explanation.caveats).map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v}`)
      : [
          'NOT A FORECAST: Recent NASA conditions represent current climate pressures, not predictive forecasts.',
          'FLOOD RISK: Direct inundation modeling is outside the MVP scope.',
          'SIMPLIFIED SEASONS: Calendar approximations based on canonical BARI guidelines.'
        ];

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
    <div className={`bg-[#092619]/90 border rounded-2xl p-4 sm:p-6 md:p-7 shadow-xl shadow-black/25 backdrop-blur-md transition-all ${
      isTopCandidate ? 'border-emerald-400/60 ring-2 ring-emerald-500/40 shadow-emerald-500/10' : 'border-emerald-500/20'
    }`}>
      {/* Top Header: Rank & Feasibility */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-5 pb-4 border-b border-emerald-800/40">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Spec Section 50: Strictly "Highest-scoring rotation", NEVER "Best rotation" */}
          {isTopCandidate ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              🏆 Highest-scoring rotation
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#051d12] text-emerald-300 border border-emerald-800/60">
              Rank #{rank} Candidate
            </span>
          )}

          {rotation.label && (
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight break-words">
              {rotation.label}
            </span>
          )}
        </div>

        {/* Feasibility Pill */}
        <div className="self-start sm:self-auto">
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center mb-6">
        {/* Left: Seasonal Crop Flow */}
        <div className="md:col-span-8 space-y-2.5 sm:space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1.5 sm:mb-2">
            Seasonal Crop Progression ({sequence.length} Seasons)
          </span>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {sequence.map((item, idx) => (
              <React.Fragment key={idx}>
                <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-2.5 sm:p-3 shadow-sm min-w-[110px] sm:min-w-[130px] flex-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/80 mb-1">
                    <span>{item.season}</span>
                    {item.duration_days && <span>{item.duration_days}d</span>}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-white truncate" title={item.crop_name || item.name}>
                    {item.crop_name || item.name}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-emerald-300/70 mt-0.5 truncate">
                    {item.crop_family || item.family}
                  </div>
                </div>

                {idx < sequence.length - 1 && (
                  <div className="text-emerald-500/70 font-black text-sm sm:text-base px-0.5 sm:px-1 select-none shrink-0">
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
        <div className="md:col-span-4 flex flex-col items-center justify-center bg-[#051d12]/60 border border-emerald-800/40 rounded-2xl p-3.5 sm:p-4">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#04140d"
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
              <span className="text-[10px] text-emerald-300/60 font-semibold mt-0.5">
                / 100 pts
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-200 mt-2 text-center">
            Overall Rotation Score
          </span>
        </div>
      </div>

      {/* Component Breakdown Bars */}
      <div className="space-y-2.5 mb-5 pt-4 border-t border-emerald-800/30">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
          Component Scores & Effective NASA Weightings
        </span>
        <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5'} gap-2.5`}>
          {components.map((comp) => {
            const hasScore = comp.score != null;
            const val = hasScore ? Math.round(comp.score * 10) / 10 : 0;
            return (
              <div
                key={comp.name}
                className="bg-[#051d12]/90 border border-emerald-800/50 rounded-xl p-2.5 shadow-sm flex flex-col justify-between overflow-hidden min-w-0"
              >
                <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
                  <span className="flex items-center gap-1 text-emerald-100 font-semibold text-[11px] truncate min-w-0" title={comp.name}>
                    <span className="shrink-0 text-xs">{comp.icon}</span>
                    <span className="truncate">{comp.name}</span>
                  </span>
                  <span className="font-mono text-xs font-black text-white px-1.5 py-0.5 rounded bg-black/50 border border-emerald-700/60 shrink-0">
                    {hasScore ? val : 'N/A'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#03130b] rounded-full h-1.5 overflow-hidden mb-1.5 shrink-0">
                  <div
                    className={`h-full ${comp.color} rounded-full transition-all duration-500`}
                    style={{ width: `${hasScore ? Math.min(100, Math.max(0, val)) : 0}%` }}
                  />
                </div>
                {comp.weight != null && (
                  <div className="text-[10px] text-emerald-300/70 font-mono flex items-center justify-between gap-1 whitespace-nowrap pt-1 border-t border-emerald-800/30">
                    <span className="text-emerald-400/80">Eff. Wt:</span>
                    <span className="text-emerald-200 font-bold">{Number(comp.weight).toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable Section 49 Traceability Drawer Toggle */}
      <div className="pt-3 border-t border-emerald-800/40">
        <button
          type="button"
          onClick={() => setIsDrawerOpen(prev => !prev)}
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#051d12] hover:bg-[#072417] border border-emerald-800/50 text-xs font-semibold text-emerald-200 transition-all shadow-sm cursor-pointer gap-1.5 sm:gap-0 text-left sm:text-center"
        >
          <span className="flex items-center gap-2">
            <span>🔍</span>
            <span>Spec Section 49 Agronomic Traceability & Audit Trail</span>
          </span>
          <span className="text-emerald-400 font-bold font-mono self-end sm:self-auto">
            {isDrawerOpen ? '▲ Hide Details' : '▼ View 8 Sub-Objects'}
          </span>
        </button>

        {/* Drawer Content */}
        {isDrawerOpen && (
          <div className="mt-3 bg-[#03140c] border border-emerald-800/60 rounded-xl p-3.5 sm:p-5 text-xs space-y-4 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-800/40 gap-1.5 sm:gap-2">
              <span className="font-bold text-white text-sm">Decision-Support Agronomic Audit Trail (8 Sub-Objects)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 self-start sm:self-auto">
                Scoring Engine: {explanation?.scoring_version || rotation.scoring_version || 'v6.2'}
              </span>
            </div>

            {/* Sub-object 1: Water Resilience */}
            <div className="space-y-1">
              <strong className="text-cyan-300 block font-bold">1. Water Resilience Rationale:</strong>
              <p className="text-emerald-200/80 leading-relaxed pl-3 border-l-2 border-cyan-500/40">
                {explanation?.water?.summary || explanation?.water?.rationale || `Water score: ${rotation.water_score ?? 'N/A'}. Evaluated against NASA SMAP soil moisture and GPM IMERG rainfall deficit.`}
              </p>
            </div>

            {/* Sub-object 2: Heat Tolerance */}
            <div className="space-y-1">
              <strong className="text-amber-300 block font-bold">2. Thermal Tolerance Rationale:</strong>
              <p className="text-emerald-200/80 leading-relaxed pl-3 border-l-2 border-amber-500/40">
                {explanation?.heat?.summary || explanation?.heat?.rationale || `Heat score: ${rotation.heat_score ?? 'N/A'}. Evaluated against MODIS land surface temperatures and hot-day frequencies.`}
              </p>
            </div>

            {/* Sub-object 3: Soil Health */}
            <div className="space-y-1">
              <strong className="text-emerald-300 block font-bold">3. Soil Health & Penalty Breakdown:</strong>
              <div className="text-emerald-200/80 pl-3 border-l-2 border-emerald-500/40 space-y-1">
                <div>Base soil health benefit: <strong className="text-white">{explanation?.soil?.base_soil_health_score ?? rotation.base_soil_health_score ?? 75} pts</strong></div>
                <div>Drainage penalty (3x3 matrix): <strong className="text-rose-300">-{Math.abs(explanation?.soil?.drainage_penalty ?? rotation.drainage_penalty ?? 0)} pts</strong></div>
                <div>Soil pH penalty (linear distance): <strong className="text-rose-300">-{Math.abs(explanation?.soil?.ph_penalty ?? rotation.ph_penalty ?? 0)} pts</strong></div>
                <div>Final soil score: <strong className="text-white">{explanation?.soil?.soil_score_final ?? explanation?.soil?.final_soil_score ?? rotation.soil_score ?? 75} pts</strong></div>
              </div>
            </div>

            {/* Sub-object 4: Crop Diversity */}
            <div className="space-y-1">
              <strong className="text-teal-300 block font-bold">4. Crop Diversity & Rotation Sequence:</strong>
              <div className="text-emerald-200/80 pl-3 border-l-2 border-teal-500/40 space-y-1">
                <div>Candidate crop families: <code className="bg-[#051d12] px-1.5 py-0.5 rounded text-white font-mono text-[11px]">{JSON.stringify(explanation?.diversity?.candidate_crop_families || sequence.map(s => s.crop_family || s.family))}</code></div>
                <div>Repeat check sequence: <code className="bg-[#051d12] px-1.5 py-0.5 rounded text-white font-mono text-[11px]">{JSON.stringify(explanation?.diversity?.repeat_check_sequence || ['Standing Crop', ...sequence.map(s => s.crop_name || s.name)])}</code></div>
                <div>Repeat penalty: <strong className="text-rose-300">-{explanation?.diversity?.adjacent_repeat_penalty ?? explanation?.diversity?.repeat_penalty ?? 0} pts</strong> (Final diversity: {explanation?.diversity?.final_diversity_score ?? rotation.diversity_score ?? 50})</div>
              </div>
            </div>

            {/* Sub-object 5: Profitability Benchmark */}
            <div className="space-y-1">
              <strong className="text-emerald-400 block font-bold">5. Gross Margin & Profitability Benchmark:</strong>
              <p className="text-emerald-200/80 leading-relaxed pl-3 border-l-2 border-emerald-500/40">
                {explanation?.profitability?.summary || `Score: ${rotation.profitability_score !== null && rotation.profitability_score !== undefined ? rotation.profitability_score : 'N/A'}. Benchmark based on BARI/BRRI gross margins.`}
              </p>
            </div>

            {/* Sub-object 6: Seasonal Feasibility Validation */}
            <div className="space-y-1">
              <strong className="text-sky-300 block font-bold">6. Seasonal Window & Feasibility Validation:</strong>
              <p className="text-emerald-200/80 leading-relaxed pl-3 border-l-2 border-sky-500/40">
                {explanation?.feasibility?.summary || `Status: ${rotation.feasibility_status || 'Seasonally feasible'}. Agronomic duration fits calendar window.`}
              </p>
            </div>

            {/* Sub-object 7: NASA Earth Observation Data Quality */}
            <div className="space-y-1">
              <strong className="text-indigo-300 block font-bold">7. NASA Earth Observation Data Quality:</strong>
              <div className="text-emerald-200/80 pl-3 border-l-2 border-indigo-500/40 space-y-1">
                <div>Observation window: <strong className="text-white">{explanation?.data_quality?.observation_window || '61-day rolling analysis'}</strong></div>
                <div>Sensors used: <span className="text-cyan-300 font-mono text-[11px]">{explanation?.data_quality?.sources_available || '4 of 4 (HLS, SMAP, GPM IMERG, MODIS LST)'}</span></div>
                <ul className="list-disc list-inside text-emerald-300/70 text-[10px] pt-1">
                  {(explanation?.data_quality?.resolution_disclosures || [
                    'HLS: 30-meter optical / NIR / SWIR',
                    'MODIS: 1 km thermal LST',
                    'SMAP: 9 km enhanced radiometer grid',
                    'GPM IMERG: 0.1 deg (~10 km) calibrated precipitation'
                  ]).map((res, i) => (
                    <li key={i}>{res}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sub-object 8: Mandatory Scientific Caveats */}
            <div className="pt-2 border-t border-emerald-800/40">
              <strong className="text-amber-400 block font-bold mb-1">8. Spec Section 56 Mandatory Disclosures:</strong>
              <ul className="list-disc list-inside text-emerald-300/70 text-[11px] space-y-1">
                {caveatsList.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

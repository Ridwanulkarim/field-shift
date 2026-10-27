import React from 'react';
import { getConditionBadge, formatDateRange, formatScore } from '../utils/formatting';

/**
 * Field Condition Score Card (Spec Section 23-25, 46)
 * Strictly renders Field Condition Score and component breakdown with Section 25 labels.
 */
export default function ScoreCard({ conditionScore, isDemo = true, dataLabel }) {
  if (!conditionScore) {
    return (
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-7 shadow-xl shadow-black/20 backdrop-blur-md">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Field Condition Score</h3>
        <p className="text-emerald-300/60 mt-2 text-sm">Insufficient NASA observations to compute condition score.</p>
      </div>
    );
  }

  const {
    score,
    label,
    vegetation_score,
    water_score,
    heat_score,
    window_start,
    window_end
  } = conditionScore;

  const badge = getConditionBadge(label);
  const dateRangeStr = formatDateRange(window_start, window_end);

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md relative overflow-hidden">
      {/* Background ambient glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: badge.color }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div>
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400 block mb-1">
            Current Environmental Health
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-3xl font-black text-white flex items-center gap-2 tracking-tight font-heading">
            Field Condition Score
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="font-bold text-emerald-300">Observation Window:</span>
            <span className="text-white font-black">{dateRangeStr}</span>
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-emerald-800/30 sm:border-t-0">
          <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1.5">
            <div className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tight tabular-nums font-heading flex items-baseline gap-1">
              {formatScore(score)}
              <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-300/80 font-heading">/100</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
              <span>{badge.icon}</span>
              <span>{label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown Bars (Spec Section 23 weights: 0.3 / 0.4 / 0.3) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-3.5 border-t border-emerald-800/40">
        {/* Vegetation Score (30%) */}
        <div className="bg-[#051d12]/85 border border-emerald-800/60 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-2 font-heading">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"></span>
              Vegetation (30%)
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-300 tabular-nums font-heading">{formatScore(vegetation_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60 mb-2">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, vegetation_score || 0))}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-emerald-200/90 font-medium leading-tight">HLS EVI canopy greenness vs baseline</p>
        </div>

        {/* Water Score (40%) */}
        <div className="bg-[#051d12]/85 border border-emerald-800/60 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-2 font-heading">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"></span>
              Water (40%)
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-cyan-300 tabular-nums font-heading">{formatScore(water_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60 mb-2">
            <div
              className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, water_score || 0))}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-cyan-200/90 font-medium leading-tight">SMAP soil moisture + GPM rain sum</p>
        </div>

        {/* Heat Score (30%) */}
        <div className="bg-[#051d12]/85 border border-emerald-800/60 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm sm:text-base md:text-lg font-black text-white flex items-center gap-2 font-heading">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"></span>
              Heat (30%)
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-amber-300 tabular-nums font-heading">{formatScore(heat_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60 mb-2">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, heat_score || 0))}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-amber-200/90 font-medium leading-tight">MODIS Day/Night LST & hot-day freq</p>
        </div>
      </div>

      {/* Provenance Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-emerald-300/70 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Formula: <code className="text-emerald-200 font-mono font-bold">100 × (1 - Stress)</code> clamped to [0, 100]
        </span>
        <span>
          Source: <span className="text-emerald-100 font-bold">{dataLabel || 'Pre-processed NASA observations'}</span>
        </span>
      </div>
    </div>
  );
}

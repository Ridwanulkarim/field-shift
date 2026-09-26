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
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/25 backdrop-blur-md relative overflow-hidden">
      {/* Background ambient glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: badge.color }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Current Environmental Health
          </span>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            Field Condition Score
          </h2>
          <p className="text-xs text-emerald-200/70 mt-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Observation Window: <span className="text-white font-medium">{dateRangeStr}</span>
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-4xl font-black text-white tracking-tight tabular-nums">
              {formatScore(score)}
              <span className="text-base font-normal text-emerald-300/60">/100</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full text-xs font-bold border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
              <span>{badge.icon}</span>
              <span>{label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown Bars (Spec Section 23 weights: 0.3 / 0.4 / 0.3) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-emerald-800/40">
        {/* Vegetation Score (30%) */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
              Vegetation (30%)
            </span>
            <span className="text-xs font-extrabold text-white tabular-nums">{formatScore(vegetation_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, vegetation_score || 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-300/60 mt-2">HLS EVI canopy greenness vs baseline</p>
        </div>

        {/* Water Score (40%) */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"></span>
              Water (40%)
            </span>
            <span className="text-xs font-extrabold text-white tabular-nums">{formatScore(water_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60">
            <div
              className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, water_score || 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-300/60 mt-2">SMAP soil moisture + GPM rain sum</p>
        </div>

        {/* Heat Score (30%) */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"></span>
              Heat (30%)
            </span>
            <span className="text-xs font-extrabold text-white tabular-nums">{formatScore(heat_score)}</span>
          </div>
          <div className="w-full bg-[#03130b] rounded-full h-2.5 overflow-hidden border border-emerald-900/60">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, heat_score || 0))}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-300/60 mt-2">MODIS Day/Night LST & hot-day frequency</p>
        </div>
      </div>

      {/* Provenance Footer */}
      <div className="mt-5 pt-3.5 border-t border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-emerald-300/60">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Formula: <code className="text-emerald-200 font-mono">100 × (1 - Stress)</code> clamped to [0, 100]
        </span>
        <span>
          Source: <span className="text-emerald-100 font-medium">{dataLabel || 'Pre-processed NASA observations'}</span>
        </span>
      </div>
    </div>
  );
}

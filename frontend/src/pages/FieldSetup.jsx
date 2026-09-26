import React from 'react';
import { getConditionBadge, formatScore } from '../utils/formatting';

/**
 * FieldSetup Page (Spec Section 46, 51)
 * Field Selection Grid showcasing 5 Predefined Bangladesh Demo Fields.
 */
export default function FieldSetup({ fields, selectedFieldId, onSelectField }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-sky-800/40">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Select Demonstration Field</h2>
          <p className="text-xs text-sky-300/70 mt-1">
            5 Pre-configured Agro-Ecological Zones with pre-processed NASA observations (Spec Section 51)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {fields.map((f) => {
          const isSelected = f.id === selectedFieldId;
          const badge = getConditionBadge(f.condition_score?.label);

          return (
            <div
              key={f.id}
              onClick={() => onSelectField(f.id)}
              className={`p-5 rounded-2xl border cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between shadow-lg ${
                isSelected
                  ? 'bg-[#0f2d4a]/95 border-sky-400 shadow-sky-500/20 ring-2 ring-sky-500/50'
                  : 'bg-[#0a1c2e]/90 border-sky-500/25 hover:bg-[#0e2740] hover:border-sky-400/50'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#061524] border border-sky-800/80 text-sky-300 font-bold">
                    Field #{f.id}
                  </span>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
                    <span>{badge.icon}</span>
                    <span>{f.condition_score?.label || 'Unknown'}</span>
                  </div>
                </div>

                {/* Field Name */}
                <h3 className="text-base font-bold text-white mb-1 leading-snug">
                  {f.name}
                </h3>
                <p className="text-[11px] text-sky-300/60 font-mono mb-4">
                  {f.latitude.toFixed(3)}°N, {f.longitude.toFixed(3)}°E
                </p>

                {/* Trait list */}
                <div className="space-y-2 text-xs text-slate-100 bg-[#071626]/80 p-3.5 rounded-xl border border-sky-800/50 mb-4 shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-sky-300/70">Soil Texture:</span>
                    <span className="font-semibold text-white truncate max-w-[170px]" title={f.soil_type}>{f.soil_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sky-300/70">pH & Drainage:</span>
                    <span className="font-semibold text-white">{f.soil_ph.toFixed(1)} • {f.drainage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sky-300/70">Current Standing:</span>
                    <span className="font-bold text-emerald-300">{f.current_crop} ({f.current_crop_family})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sky-300/70">Irrigation Access:</span>
                    <span className={`font-bold ${f.irrigation_available ? 'text-cyan-300' : 'text-amber-300'}`}>
                      {f.irrigation_available ? 'Irrigated' : 'Rainfed'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom score bar */}
              <div className="pt-3 border-t border-sky-800/40 flex items-center justify-between">
                <span className="text-xs text-sky-300/70">Condition Score:</span>
                <span className="text-base font-black text-white tabular-nums">
                  {formatScore(f.condition_score?.score)}
                  <span className="text-xs font-normal text-sky-300/60">/100</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

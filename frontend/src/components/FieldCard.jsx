import React from 'react';

/**
 * FieldCard Component (Spec Section 46, 51)
 * Displays active field metadata, soil parameters, standing crops, and multi-year crop history.
 */
export default function FieldCard({ field, cropHistory = [], isLoadingHistory = false }) {
  if (!field) {
    return (
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-7 shadow-xl shadow-black/20 backdrop-blur-md">
        <p className="text-emerald-300/70 text-sm">Select a field to view agro-ecological and soil profiles.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 sm:mb-5 pb-3 border-b border-emerald-800/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs sm:text-sm font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-bold">
              Field #{field.id}
            </span>
            <span className="text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-600/40 text-emerald-200 font-semibold truncate max-w-[200px] sm:max-w-none">
              {field.data_label || 'Pre-processed NASA observations'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">{field.name}</h2>
          <p className="text-xs sm:text-sm text-emerald-300/80 font-mono mt-1">
            Lat: {field.latitude.toFixed(4)}°N, Lon: {field.longitude.toFixed(4)}°E
          </p>
        </div>

        <div className="sm:text-right pt-2 sm:pt-0 border-t border-emerald-800/30 sm:border-t-0 flex sm:flex-col items-center sm:items-end justify-between">
          <span className="text-xs font-semibold text-emerald-300/80 block sm:mb-1">Irrigation Access</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold border shadow-sm ${
            field.irrigation_available
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${field.irrigation_available ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'}`}></span>
            {field.irrigation_available ? 'Irrigated (STW / Canal)' : 'Rainfed (No STW)'}
          </span>
        </div>
      </div>

      {/* Grid: Soil & Cropping Profile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        {/* Soil Type */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3 sm:p-3.5 shadow-sm">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Soil Texture</span>
          <span className="text-sm sm:text-base font-extrabold text-white block truncate" title={field.soil_type}>
            {field.soil_type}
          </span>
        </div>

        {/* Soil pH */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3 sm:p-3.5 shadow-sm">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Soil pH</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-white">{field.soil_ph.toFixed(2)}</span>
            <span className="text-xs text-emerald-300/70 font-semibold">
              {field.soil_ph < 6.0 ? '(Acidic)' : field.soil_ph > 7.5 ? '(Alkaline)' : '(Neutral)'}
            </span>
          </div>
        </div>

        {/* Drainage */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3 sm:p-3.5 shadow-sm">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Drainage</span>
          <span className="text-sm sm:text-base font-extrabold text-white capitalize">
            {field.drainage}
          </span>
        </div>

        {/* Organic Matter */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3 sm:p-3.5 shadow-sm">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Organic Matter</span>
          <span className="text-base sm:text-lg font-black text-white">
            {field.organic_matter_percent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Standing & Prior Crop Context (Spec Section 30 Cycle Context) */}
      <div className="bg-[#051d12]/90 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4.5 mb-4 sm:mb-5 shadow-sm">
        <h4 className="text-xs sm:text-sm font-extrabold text-emerald-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Current Cropping Context (Rabi 2023–24)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 bg-[#03130b]/60 p-3 sm:p-3.5 rounded-xl border border-emerald-900/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xl shadow-sm shrink-0">
              🌾
            </div>
            <div className="min-w-0">
              <span className="text-xs text-emerald-300/80 block font-semibold">Standing Current Crop</span>
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-sm sm:text-base font-black text-white truncate">{field.current_crop}</span>
                <span className="text-xs sm:text-sm text-emerald-400 font-bold shrink-0">({field.current_crop_family})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#03130b]/60 p-3 sm:p-3.5 rounded-xl border border-emerald-900/50">
            <div className="w-10 h-10 rounded-xl bg-[#0a291b] border border-emerald-800/60 flex items-center justify-center text-emerald-300/70 font-bold text-xl shadow-sm shrink-0">
              ⏮
            </div>
            <div className="min-w-0">
              <span className="text-xs text-emerald-300/80 block font-semibold">Previous Season Crop (Kharif-2)</span>
              <div className="flex items-baseline gap-1.5 truncate">
                <span className="text-sm sm:text-base font-black text-emerald-100 truncate">{field.previous_crop}</span>
                <span className="text-xs sm:text-sm text-emerald-300/80 font-bold shrink-0">({field.previous_crop_family})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Year Crop History (2019-2023) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs sm:text-sm font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Crop History (2019–2023 Timeline)
          </h4>
          <span className="text-xs text-emerald-400/70 italic font-medium">
            Labeled: hand-entered demo data
          </span>
        </div>

        {isLoadingHistory ? (
          <div className="text-center py-5 text-sm text-emerald-300/70">Loading multi-year crop history...</div>
        ) : cropHistory.length === 0 ? (
          <div className="text-center py-5 text-sm text-emerald-300/70">No multi-year crop records available.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {cropHistory.map((h) => (
              <div key={h.id || `${h.year}-${h.season}`} className="bg-[#051d12]/90 border border-emerald-800/50 rounded-xl p-2.5 sm:p-3 text-center shadow-sm hover:border-emerald-600/50 transition-colors">
                <span className="text-xs font-mono text-emerald-400 font-bold block">{h.year} • {h.season}</span>
                <span className="text-xs sm:text-sm font-black text-white block truncate mt-1" title={h.crop}>
                  {h.crop}
                </span>
                <span className="text-xs text-emerald-300/80 block mt-0.5 font-medium">{h.crop_family}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

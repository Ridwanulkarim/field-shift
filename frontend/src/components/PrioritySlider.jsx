import React from 'react';

/**
 * PrioritySlider Component (Spec Section 37 & 39, 46, 54)
 * Allows farmers/extension agents to configure 1–5 priority weights.
 * Displays live NASA climate-aware multipliers:
 *   effective_water_weight = water_priority * (1 + adjusted_water_stress)
 *   effective_heat_weight  = heat_priority * (1 + heat_stress_index)
 * Natural range is 1.0x to 2.0x (Spec Section 39). Zero artificial cap below 2.0x.
 */
export default function PrioritySlider({
  priorities = { water: 3, heat: 3, soil: 3, diversity: 3, profitability: 3 },
  onChange,
  waterStress = 0,
  heatStress = 0,
  fieldName = 'Selected Field',
  irrigationAvailable = false
}) {
  // Spec Section 37 & 39: multiplier = 1 + stress (0 to 1 -> 1.0x to 2.0x)
  const safeWaterStress = Math.max(0, Math.min(1, Number(waterStress) || 0));
  const safeHeatStress = Math.max(0, Math.min(1, Number(heatStress) || 0));

  const waterMultiplier = 1 + safeWaterStress;
  const heatMultiplier = 1 + safeHeatStress;

  const effectiveWaterWeight = (priorities.water * waterMultiplier).toFixed(2);
  const effectiveHeatWeight = (priorities.heat * heatMultiplier).toFixed(2);

  const handlePriorityChange = (key, value) => {
    if (onChange) {
      onChange({
        ...priorities,
        [key]: Number(value)
      });
    }
  };

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-800/40">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Spec Section 37 & 39 Farmer Priorities
          </span>
          <h3 className="text-xl font-extrabold text-white tracking-tight">
            Decision Priorities & NASA Multipliers
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-medium">
            Active: <strong className="text-white">{fieldName}</strong>
          </span>
        </div>
      </div>

      {/* Explanatory Banner: Section 39 Natural 1.0x to 2.0x Multiplier Mechanism */}
      <div className="bg-[#042116]/90 border border-emerald-600/40 rounded-xl p-4 mb-6 text-sm text-emerald-100 shadow-sm">
        <p className="flex items-start gap-2.5">
          <span className="text-emerald-400 text-lg leading-none mt-0.5">ℹ</span>
          <span className="leading-relaxed">
            <strong className="font-bold text-emerald-300">NASA Climate Weighting:</strong> Regional satellite stress metrics automatically scale your water and heat priorities via <code className="bg-[#03140c] px-2 py-0.5 rounded text-cyan-300 font-mono text-xs">weight = priority × (1 + stress)</code>. When stress is severe, NASA data amplifies that priority up to <strong>2.0×</strong> to protect farm yield.
          </span>
        </p>
      </div>

      {/* Grid of 5 Sliders */}
      <div className="space-y-6">
        {/* 1. WATER CONSERVATION PRIORITY */}
        <div className="bg-[#051d12]/80 border border-cyan-800/40 rounded-xl p-4 sm:p-5 transition-colors hover:border-cyan-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💧</span>
              <div>
                <span className="text-base font-extrabold text-white">Water Conservation Priority</span>
                <span className="text-xs text-cyan-200/80 block mt-0.5">
                  Crops with low water demand (e.g. Chickpea, Lentil vs high-demand Boro Rice)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              <span className="text-sm font-mono font-bold px-2.5 py-1 rounded bg-cyan-950/90 text-cyan-200 border border-cyan-800/80">
                Level {priorities.water}/5
              </span>
              <span className="text-sm font-mono font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {waterMultiplier.toFixed(2)}× Multiplier
              </span>
              <span className="text-sm font-mono font-extrabold px-3 py-1 rounded-full bg-cyan-400 text-[#04140d]">
                Eff. Weight: {effectiveWaterWeight}
              </span>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={priorities.water}
              onChange={(e) => handlePriorityChange('water', e.target.value)}
              className="w-full accent-cyan-400 cursor-pointer h-2.5 bg-[#03140c] rounded-lg appearance-none"
            />
            <span className="text-base font-black text-cyan-300 w-5 text-center">{priorities.water}</span>
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-emerald-300/70 font-mono">
            <span>1 (Minimal water concern)</span>
            <span>NASA Adjusted Stress: {(safeWaterStress * 100).toFixed(1)}% {irrigationAvailable ? '(Irrigation factor 0.7 applied)' : '(Rainfed)'}</span>
            <span>5 (Critical water saving)</span>
          </div>
        </div>

        {/* 2. HEAT AVOIDANCE PRIORITY */}
        <div className="bg-[#051d12]/80 border border-amber-800/40 rounded-xl p-4 transition-colors hover:border-amber-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <div>
                <span className="text-sm font-bold text-white">Heat Avoidance Priority</span>
                <span className="text-[11px] text-amber-300/70 block">
                  Selects crops tolerating high thermal anomaly and hot days (MODIS LST)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-950/90 text-amber-200 border border-amber-800/80">
                Level {priorities.heat}/5
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {heatMultiplier.toFixed(2)}× Multiplier
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400 text-[#04140d]">
                Eff. Weight: {effectiveHeatWeight}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={priorities.heat}
              onChange={(e) => handlePriorityChange('heat', e.target.value)}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-[#03140c] rounded-lg appearance-none"
            />
            <span className="text-sm font-black text-amber-300 w-4 text-center">{priorities.heat}</span>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-emerald-300/50 font-mono">
            <span>1 (Ignore heat stress)</span>
            <span>Current NASA Heat Stress Index: {(safeHeatStress * 100).toFixed(1)}%</span>
            <span>5 (Critical thermal tolerance)</span>
          </div>
        </div>

        {/* 3. SOIL HEALTH PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌿</span>
              <div>
                <span className="text-sm font-bold text-white">Soil Health Priority</span>
                <span className="text-[11px] text-emerald-300/70 block">
                  Encourages N-fixing legumes, biomass additions, and drainage/pH fit
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                Level {priorities.soil}/5
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                Weight: {priorities.soil.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={priorities.soil}
              onChange={(e) => handlePriorityChange('soil', e.target.value)}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-[#03140c] rounded-lg appearance-none"
            />
            <span className="text-sm font-black text-emerald-300 w-4 text-center">{priorities.soil}</span>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-emerald-300/50 font-mono">
            <span>1 (Low soil replenishment)</span>
            <span>Fixed Weight (Not altered by NASA stress)</span>
            <span>5 (Maximum organic replenishment)</span>
          </div>
        </div>

        {/* 4. CROP DIVERSITY PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <div>
                <span className="text-sm font-bold text-white">Crop Diversity Priority</span>
                <span className="text-[11px] text-emerald-300/70 block">
                  Penalizes monoculture repeats; promotes rotation of different botanical families
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                Level {priorities.diversity}/5
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                Weight: {priorities.diversity.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={priorities.diversity}
              onChange={(e) => handlePriorityChange('diversity', e.target.value)}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-[#03140c] rounded-lg appearance-none"
            />
            <span className="text-sm font-black text-emerald-300 w-4 text-center">{priorities.diversity}</span>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-emerald-300/50 font-mono">
            <span>1 (Allow consecutive crop families)</span>
            <span>Fixed Weight (Spec Section 31 Family Ratio)</span>
            <span>5 (Strict botanical family rotation)</span>
          </div>
        </div>

        {/* 5. MARKET PROFITABILITY PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <div>
                <span className="text-sm font-bold text-white">Market Profitability Priority</span>
                <span className="text-[11px] text-emerald-300/70 block">
                  Considers relative net returns and market value (Potato, Mustard vs pulses)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                Level {priorities.profitability}/5
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                Weight: {priorities.profitability.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={priorities.profitability}
              onChange={(e) => handlePriorityChange('profitability', e.target.value)}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-[#03140c] rounded-lg appearance-none"
            />
            <span className="text-sm font-black text-emerald-300 w-4 text-center">{priorities.profitability}</span>
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-emerald-300/50 font-mono">
            <span>1 (Subsistence / low financial pressure)</span>
            <span>Dropped if crop profitability is unverified (Spec Section 36)</span>
            <span>5 (High cash-crop commercial focus)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

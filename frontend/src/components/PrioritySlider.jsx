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
  irrigationAvailable = false,
  lang = 'en'
}) {
  const isBn = lang === 'bn';

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
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-800/40">
        <div>
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            {isBn ? 'অভিযোজিত পরিবেশগত অগ্রাধিকার' : 'Adaptive Environmental Weighting'}
          </span>
          <h3 className="text-xl sm:text-2xl md:text-2xl font-black text-white tracking-tight font-heading">
            {isBn ? 'সিদ্ধান্ত অগ্রাধিকার ও নাসা গুণকসমূহ' : 'Decision Priorities & NASA Multipliers'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-medium">
            {isBn ? 'সক্রিয় মাঠ:' : 'Active:'} <strong className="text-white">{fieldName}</strong>
          </span>
        </div>
      </div>

      {/* Explanatory Banner: Section 39 Natural 1.0x to 2.0x Multiplier Mechanism */}
      <div className="bg-[#042116]/90 border border-emerald-600/40 rounded-xl p-3.5 sm:p-4 mb-6 text-xs sm:text-sm text-emerald-100 shadow-sm">
        <p className="flex items-start gap-2.5">
          <span className="text-emerald-400 text-lg leading-none mt-0.5">ℹ</span>
          <span className="leading-relaxed">
            <strong className="font-bold text-emerald-300">
              {isBn ? 'নাসা জলবায়ু গুরুত্ব:' : 'NASA Climate Weighting:'}
            </strong>{' '}
            {isBn
              ? 'আঞ্চলিক উপগ্রহের চাপ নির্দেশক স্বয়ংক্রিয়ভাবে পানি ও তাপের অগ্রাধিকারকে'
              : 'Regional satellite stress metrics automatically scale your water and heat priorities via'}{' '}
            <code className="bg-[#03140c] px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[11px] sm:text-xs">
              {isBn ? 'কার্যকর গুরুত্ব = অগ্রাধিকার × (১ + চাপ)' : 'weight = priority × (1 + stress)'}
            </code>
            {isBn
              ? ' সূত্রের মাধ্যমে পরিবর্ধন করে। তীব্র খরা বা তাপদাহে নাসা ডেটা সেই অগ্রাধিকারকে সর্বোচ্চ ২.০ গুণ পর্যন্ত বৃদ্ধি করে ফসলের ফলন রক্ষা করে।'
              : '. When stress is severe, NASA data amplifies that priority up to 2.0× to protect farm yield.'}
          </span>
        </p>
      </div>

      {/* Grid of 5 Sliders */}
      <div className="space-y-5 sm:space-y-6">
        {/* 1. WATER CONSERVATION PRIORITY */}
        <div className="bg-[#051d12]/80 border border-cyan-800/40 rounded-xl p-3.5 sm:p-5 transition-colors hover:border-cyan-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="text-xl sm:text-2xl">💧</span>
              <div>
                <span className="text-sm sm:text-base font-extrabold text-white">
                  {isBn ? 'পানি সংরক্ষণ অগ্রাধিকার' : 'Water Conservation Priority'}
                </span>
                <span className="text-[11px] sm:text-xs text-cyan-200/80 block mt-0.5">
                  {isBn
                    ? 'স্বল্প পানির চাহিদাসম্পন্ন ফসল (যেমন ছোলা, মসুর বনাম অতি-চাহিদাপূর্ণ বোরো ধান)'
                    : 'Crops with low water demand (e.g. Chickpea, Lentil vs high-demand Boro Rice)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
              <span className="text-xs sm:text-sm font-mono font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-cyan-950/90 text-cyan-200 border border-cyan-800/80">
                {isBn ? `মাত্রা ${priorities.water}/৫` : `Level ${priorities.water}/5`}
              </span>
              <span className="text-xs sm:text-sm font-mono font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {waterMultiplier.toFixed(2)}× {isBn ? 'গুণক' : 'Multiplier'}
              </span>
              <span className="text-xs sm:text-sm font-mono font-extrabold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-cyan-400 text-[#04140d]">
                {isBn ? 'কার্যকর গুরুত্ব:' : 'Eff. Weight:'} {effectiveWaterWeight}
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
          <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] sm:text-xs text-emerald-300/70 font-mono gap-1">
            <div className="flex justify-between items-center sm:contents">
              <span>1 ({isBn ? 'ন্যূনতম বিবেচনা' : 'Minimal concern'})</span>
              <span className="text-center text-cyan-300 font-semibold my-0.5 sm:my-0">
                {isBn ? 'নাসা চাপ:' : 'NASA Stress:'} {(safeWaterStress * 100).toFixed(1)}% {irrigationAvailable ? (isBn ? '(সেচযুক্ত ০.৭x)' : '(Irrigated 0.7x)') : (isBn ? '(বৃষ্টি-নির্ভর)' : '(Rainfed)')}
              </span>
              <span>5 ({isBn ? 'সর্বোচ্চ পানি সাশ্রয়' : 'Critical saving'})</span>
            </div>
          </div>
        </div>

        {/* 2. HEAT AVOIDANCE PRIORITY */}
        <div className="bg-[#051d12]/80 border border-amber-800/40 rounded-xl p-3.5 sm:p-4 transition-colors hover:border-amber-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔥</span>
              <div>
                <span className="text-sm font-bold text-white">
                  {isBn ? 'তাপ সহনশীলতা অগ্রাধিকার' : 'Heat Avoidance Priority'}
                </span>
                <span className="text-[11px] text-amber-300/70 block">
                  {isBn
                    ? 'উচ্চ তাপমাত্রা ও চরম গরম সহ্য করতে সক্ষম ফসল নির্বাচন (MODIS LST)'
                    : 'Selects crops tolerating high thermal anomaly and hot days (MODIS LST)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-950/90 text-amber-200 border border-amber-800/80">
                {isBn ? `মাত্রা ${priorities.heat}/৫` : `Level ${priorities.heat}/5`}
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {heatMultiplier.toFixed(2)}× {isBn ? 'গুণক' : 'Multiplier'}
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400 text-[#04140d]">
                {isBn ? 'কার্যকর গুরুত্ব:' : 'Eff. Weight:'} {effectiveHeatWeight}
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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-[11px] text-emerald-300/60 font-mono gap-1">
            <div className="flex justify-between items-center sm:contents">
              <span>1 ({isBn ? 'তাপমাত্রা উপেক্ষা' : 'Ignore heat'})</span>
              <span className="text-center text-amber-300 font-semibold my-0.5 sm:my-0">
                {isBn ? 'নাসা তাপীয় চাপ:' : 'NASA Heat Stress:'} {(safeHeatStress * 100).toFixed(1)}%
              </span>
              <span>5 ({isBn ? 'চরম তাপ সহনশীলতা' : 'Critical thermal tolerance'})</span>
            </div>
          </div>
        </div>

        {/* 3. SOIL HEALTH PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🌿</span>
              <div>
                <span className="text-sm font-bold text-white">
                  {isBn ? 'মাটির স্বাস্থ্য বৃদ্ধি অগ্রাধিকার' : 'Soil Health Priority'}
                </span>
                <span className="text-[11px] text-emerald-300/70 block">
                  {isBn
                    ? 'নাইট্রোজেন সংবন্ধনকারী ডালশস্য, বায়োমাস বৃদ্ধি এবং মাটির পিএইচ/নিষ্কাশন উপযোগিতা'
                    : 'Encourages N-fixing legumes, biomass additions, and drainage/pH fit'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                {isBn ? `মাত্রা ${priorities.soil}/৫` : `Level ${priorities.soil}/5`}
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                {isBn ? 'গুরুত্ব:' : 'Weight:'} {priorities.soil.toFixed(2)}
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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-[11px] text-emerald-300/60 font-mono gap-1">
            <div className="flex justify-between items-center sm:contents">
              <span>1 ({isBn ? 'কম মাটি সুরক্ষা' : 'Low soil replenishment'})</span>
              <span className="text-center text-emerald-300/80">
                {isBn ? 'স্থির গুরুত্ব (চাপ নিরপেক্ষ)' : 'Fixed Weight (Independent of stress)'}
              </span>
              <span>5 ({isBn ? 'সর্বোচ্চ জৈব পুষ্টি বৃদ্ধি' : 'Max organic replenishment'})</span>
            </div>
          </div>
        </div>

        {/* 4. CROP DIVERSITY PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔄</span>
              <div>
                <span className="text-sm font-bold text-white">
                  {isBn ? 'শস্য বৈচিত্র্য অগ্রাধিকার' : 'Crop Diversity Priority'}
                </span>
                <span className="text-[11px] text-emerald-300/70 block">
                  {isBn
                    ? 'একই জাতের ফসলের পুনরাবৃত্তিতে পেনাল্টি; বিভিন্ন বোটানিক্যাল গোত্রের পরিবর্তন উৎসাহিত করে'
                    : 'Penalizes monoculture repeats; promotes rotation of different botanical families'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                {isBn ? `মাত্রা ${priorities.diversity}/৫` : `Level ${priorities.diversity}/5`}
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                {isBn ? 'গুরুত্ব:' : 'Weight:'} {priorities.diversity.toFixed(2)}
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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-[11px] text-emerald-300/60 font-mono gap-1">
            <div className="flex justify-between items-center sm:contents">
              <span>1 ({isBn ? 'একই গোত্র পুনরাবৃত্তি অনুমোদিত' : 'Allow consecutive families'})</span>
              <span className="text-center text-emerald-300/80">
                {isBn ? 'স্থির গুরুত্ব (বোটানিক্যাল বৈচিত্র্য)' : 'Fixed Weight (Botanical diversity)'}
              </span>
              <span>5 ({isBn ? 'কঠোর গোত্র পরিবর্তন' : 'Strict family rotation'})</span>
            </div>
          </div>
        </div>

        {/* 5. MARKET PROFITABILITY PRIORITY */}
        <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-3.5 sm:p-4 transition-colors hover:border-emerald-700/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💰</span>
              <div>
                <span className="text-sm font-bold text-white">
                  {isBn ? 'বাজার মুনাফা অগ্রাধিকার' : 'Market Profitability Priority'}
                </span>
                <span className="text-[11px] text-emerald-300/70 block">
                  {isBn
                    ? 'তুলনামূলক নিট লাভ এবং বাজারের মূল্য বিবেচনা করে (আলু, সরিষা বনাম ডাল)'
                    : 'Considers relative net returns and market value (Potato, Mustard vs pulses)'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-200 border border-emerald-800/80">
                {isBn ? `মাত্রা ${priorities.profitability}/৫` : `Level ${priorities.profitability}/5`}
              </span>
              <span className="text-xs font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400 text-[#04140d]">
                {isBn ? 'গুরুত্ব:' : 'Weight:'} {priorities.profitability.toFixed(2)}
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
          <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-[11px] text-emerald-300/60 font-mono gap-1">
            <div className="flex justify-between items-center sm:contents">
              <span>1 ({isBn ? 'জীবনধারণভিত্তিক চাষ' : 'Subsistence focus'})</span>
              <span className="text-center text-emerald-300/80">
                {isBn ? 'বাজার নিট আয় সূচক' : 'Market Net Return Index'}
              </span>
              <span>5 ({isBn ? 'সর্বোচ্চ অর্থকরী ফসল লক্ষ্য' : 'High cash-crop focus'})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

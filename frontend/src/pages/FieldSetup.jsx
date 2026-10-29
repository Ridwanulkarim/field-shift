import React from 'react';
import { getConditionBadge, formatScore } from '../utils/formatting';
import {
  translateCrop,
  translateCropFamily,
  translateSoilType,
  translateFieldName,
  translateDrainage
} from '../utils/i18n';

/**
 * FieldSetup Page (Spec Section 46, 51)
 * Field Selection Grid showcasing 5 Predefined Bangladesh Demo Fields.
 */
export default function FieldSetup({ fields, selectedFieldId, onSelectField, lang = 'en' }) {
  const isBn = lang === 'bn';

  const formatBadgeLabel = (label) => {
    if (!isBn || !label) return label || 'Unknown';
    const l = label.toLowerCase();
    if (l.includes('optimal')) return 'অনুকূল';
    if (l.includes('watch')) return 'নজরদারি';
    if (l.includes('severe')) return 'তীব্র চাপ';
    if (l.includes('stress')) return 'চাপগ্রস্ত';
    return label;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-800/40">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
            {isBn ? 'ডেমো ফসলি মাঠ নির্বাচন করুন' : 'Select Demonstration Field'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-300/80 mt-1">
            {isBn
              ? 'নাসা আর্থ অবজারভেশনের সাথে যুক্ত বাংলাদেশের ৫টি প্রতিভূ কৃষি-পরিবেশ অঞ্চল (AEZ)'
              : '5 Representative Bangladesh Agro-Ecological Zones with Live NASA Earth Observations'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {fields.map((f) => {
          const isSelected = f.id === selectedFieldId;
          const badge = getConditionBadge(f.condition_score?.label);

          return (
            <div
              key={f.id}
              onClick={() => onSelectField(f.id)}
              className={`p-5 sm:p-6 rounded-2xl border cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between shadow-lg ${
                isSelected
                  ? 'bg-[#0a2e1d] border-emerald-400 shadow-emerald-500/15 ring-2 ring-emerald-500/50'
                  : 'bg-[#092619]/90 border-emerald-500/20 hover:bg-[#0c3523] hover:border-emerald-400/50'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#04140d] border border-emerald-800/80 text-emerald-300 font-bold">
                    {isBn ? 'মাঠ #' : 'Field #'}{f.id}
                  </span>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}>
                    <span>{badge.icon}</span>
                    <span>{formatBadgeLabel(f.condition_score?.label)}</span>
                  </div>
                </div>

                {/* Field Name */}
                <h3 className="text-lg sm:text-xl font-black text-white mb-1.5 leading-snug font-heading">
                  {isBn ? translateFieldName(f.name, lang) : f.name}
                </h3>
                <p className="text-xs text-emerald-300/70 font-mono mb-4">
                  {f.latitude.toFixed(3)}°N, {f.longitude.toFixed(3)}°E
                </p>

                {/* Trait list */}
                <div className="space-y-2.5 text-xs sm:text-sm text-emerald-100 bg-[#051d12]/80 p-4 rounded-xl border border-emerald-800/50 mb-4 shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-300/70">{isBn ? 'মাটির বুনট:' : 'Soil Texture:'}</span>
                    <span className="font-semibold text-white truncate max-w-[170px]" title={f.soil_type}>
                      {isBn ? translateSoilType(f.soil_type, lang) : f.soil_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-300/70">{isBn ? 'পিএইচ ও নিষ্কাশন:' : 'pH & Drainage:'}</span>
                    <span className="font-semibold text-white">
                      {f.soil_ph.toFixed(1)} • {isBn ? translateDrainage(f.drainage, lang) : f.drainage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-300/70">{isBn ? 'বিদ্যমান চলতি ফসল:' : 'Current Standing:'}</span>
                    <span className="font-bold text-emerald-300 font-heading">
                      {isBn ? translateCrop(f.current_crop, lang) : f.current_crop} ({isBn ? translateCropFamily(f.current_crop_family, lang) : f.current_crop_family})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-300/70">{isBn ? 'সেচ প্রাপ্যতা:' : 'Irrigation Access:'}</span>
                    <span className={`font-bold ${f.irrigation_available ? 'text-cyan-300' : 'text-amber-300'}`}>
                      {f.irrigation_available ? (isBn ? 'সেচযুক্ত' : 'Irrigated') : (isBn ? 'বৃষ্টি-নির্ভর' : 'Rainfed')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom score bar */}
              <div className="pt-3.5 border-t border-emerald-800/40 flex items-center justify-between">
                <span className="text-xs text-emerald-300/70">{isBn ? 'পরিবেশগত স্বাস্থ্য স্কোর:' : 'Condition Score:'}</span>
                <span className="text-lg sm:text-xl font-black text-white tabular-nums font-heading">
                  {formatScore(f.condition_score?.score)}
                  <span className="text-xs font-normal text-emerald-300/60 font-heading">/100</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

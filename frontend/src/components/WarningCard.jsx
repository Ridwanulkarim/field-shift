import React, { useState } from 'react';
import { MANDATORY_DISCLOSURES, t } from '../utils/i18n';

/**
 * WarningCard Component (Spec Section 46, 52, 56)
 * Renders all 7 Spec Section 56 Mandatory Disclosures and operational limitations,
 * with bilingual English/Bengali support and expandable full-detail view.
 */
export default function WarningCard({ lang = 'en', risks = [] }) {
  const [expandedDisclosure, setExpandedDisclosure] = useState(null);

  return (
    <div className="bg-[#0a1c2e]/90 border border-sky-500/25 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/35 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-sky-800/40">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
            Spec Section 56 Mandatory Compliance
          </span>
          <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>🛡️</span> {t('disclosures_title', lang)}
          </h3>
          <p className="text-xs text-sky-300/70 mt-1">
            {t('disclosures_subtitle', lang)}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          7 of 7 Disclosures Active
        </span>
      </div>

      {/* Agronomic Risk Callouts (if provided) */}
      {risks.length > 0 && (
        <div className="mb-6 space-y-2">
          {risks.map((risk, idx) => (
            <div key={idx} className="bg-amber-950/40 border border-amber-700/60 p-3.5 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
              <span className="text-amber-400 text-sm mt-0.5">⚠</span>
              <div>
                <strong className="text-white block">{risk.title}</strong>
                <span className="text-amber-200/80 leading-relaxed">{risk.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid of 7 Mandatory Disclosures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {MANDATORY_DISCLOSURES.map((item) => {
          const isExpanded = expandedDisclosure === item.id;
          const title = lang === 'bn' ? item.title_bn : item.title_en;
          const text = lang === 'bn' ? item.text_bn : item.text_en;

          return (
            <div
              key={item.id}
              className={`bg-[#071626]/85 border rounded-xl p-4 transition-all duration-200 shadow-sm cursor-pointer ${
                isExpanded ? 'border-sky-400/80 bg-[#0d2a45]' : 'border-sky-800/50 hover:border-sky-600/50'
              }`}
              onClick={() => setExpandedDisclosure(isExpanded ? null : item.id)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-950 border border-sky-700/80 text-sky-300 font-mono text-[11px] font-bold flex items-center justify-center">
                    {item.number}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {title}
                  </span>
                </div>
                <span className="text-sky-400/60 text-xs font-mono">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>

              <p className={`text-xs text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                {text}
              </p>

              {isExpanded && (
                <div className="mt-3 pt-2.5 border-t border-sky-900/60 text-[11px] text-sky-400/80 flex items-center justify-between">
                  <span className="italic">Clause #{item.number} • Spec Section 56 Ground Truth</span>
                  <span className="font-mono text-[10px] bg-sky-950 px-2 py-0.5 rounded text-sky-300 border border-sky-800">
                    ID: {item.id}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

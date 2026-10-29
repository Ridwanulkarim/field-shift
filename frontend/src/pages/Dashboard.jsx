import React from 'react';
import ScoreCard from '../components/ScoreCard';
import Map from '../components/Map';
import FieldCard from '../components/FieldCard';
import DataQuality from '../components/DataQuality';
import Charts from '../components/Charts';

/**
 * Dashboard Page (Spec Section 46, 54, 55)
 * Combines Field Condition, Map, Soil Context, NASA Data Quality, and Stress Timelines.
 */
export default function Dashboard({
  fields = [],
  selectedField,
  cropHistory = [],
  isLoadingHistory = false,
  onSelectField,
  onSelectTab
}) {
  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Playbook 07 Killer Demo Callout Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#062417] to-cyan-950 border border-emerald-500/50 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-pulse">📢</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                NASA Space Apps 25-Year Climatology Killer Demo
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                Offline Mode: Active
              </span>
            </div>
            <p className="text-xs sm:text-sm font-extrabold text-white mt-0.5">
              Rajshahi Aman Monsoon Onset Shifted <span className="text-amber-300 underline">+11 Days Later</span> since 2001 (DOY 154 → 165, p=0.021).
            </p>
          </div>
        </div>
        {onSelectTab && (
          <button
            onClick={() => onSelectTab('advisory')}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Planting Advisory</span>
            <span>↗</span>
          </button>
        )}
      </div>

      {/* Top Section: Condition Score & Agro-Ecological Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6">
        {/* Left: Score Card */}
        <div className="lg:col-span-7 flex flex-col gap-4 sm:gap-5 lg:gap-6">
          <ScoreCard
            conditionScore={selectedField?.condition_score}
            isDemo={selectedField?.is_demo}
            dataLabel={selectedField?.data_label}
          />
          {/* Detailed Field Profile & Crop History */}
          <FieldCard
            field={selectedField}
            cropHistory={cropHistory}
            isLoadingHistory={isLoadingHistory}
          />
        </div>

        {/* Right: Bangladesh Map with Pins */}
        <div className="lg:col-span-5">
          <Map
            fields={fields}
            selectedFieldId={selectedField?.id}
            onSelectField={onSelectField}
          />
        </div>
      </div>

      {/* Environmental Stress Trends */}
      <Charts fieldId={selectedField?.id} nasaMetadata={selectedField?.nasa_metadata} />

      {/* NASA Data Quality & Provenance Audit */}
      <DataQuality conditionScore={selectedField?.condition_score} nasaMetadata={selectedField?.nasa_metadata} />
    </div>
  );
}

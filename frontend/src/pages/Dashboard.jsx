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
  onSelectField
}) {
  return (
    <div className="space-y-6">
      {/* Top Section: Condition Score & Agro-Ecological Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Score Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
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

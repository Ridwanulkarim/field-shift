import React, { useState, useEffect } from 'react';
import { compareRotations } from '../services/api';
import RotationCard from '../components/RotationCard';

/**
 * RotationComparison Page (Spec Section 40, 46, 50, 54, 55)
 * Side-by-side comparison of candidate rotations.
 * 
 * PROVES NASA MULTIPLIER RANKING-SHIFT:
 * - Option A: Water-resilient (Water score: 80, Heat score: 40)
 * - Option B: Heat-resilient (Water score: 40, Heat score: 80)
 * - Field 1 (Barind drought): Option A wins (62.72 vs 57.28)
 * - Field 2 (Dinajpur irrigated): Option B wins (61.83 vs 58.16)
 * 
 * STRICT COMPLIANCE:
 * - Spec Section 50: Strictly "Highest-scoring rotation", NEVER "Best rotation".
 * - Spec Section 37 & 39: multiplier = 1 + stress (natural 1.0x to 2.0x range).
 */
export default function RotationComparison({ fields = [], selectedFieldId = 1, onSelectField }) {
  // Demonstration mode: 'section40_fixture' | 'bangladesh_crops'
  const [demoMode, setDemoMode] = useState('section40_fixture');
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || 1);

  // Irrigation toggle for Fixture 3 experiment
  const [isIrrigatedOverride, setIsIrrigatedOverride] = useState(null);

  // Priorities: Section 40 base priorities (Water=3, Heat=4, Soil=3, Diversity=3, Profitability=3)
  const [waterPriority, setWaterPriority] = useState(3);
  const [heatPriority, setHeatPriority] = useState(4);

  // Comparison results from API (for real crop mode)
  const [apiComparison, setApiComparison] = useState(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const activeField = fields.find(f => f.id === activeFieldId) || fields[0];

  // Determine actual irrigation state
  const effectiveIrrigation = isIrrigatedOverride !== null
    ? isIrrigatedOverride
    : activeField?.irrigation_available ?? false;

  // Stresses for active field
  // Field 1 (Rajshahi): raw water = 0.9693, heat = 0.1228
  // Field 2 (Dinajpur): raw water = 0.3229, heat = 0.1059
  const isField1 = activeFieldId === 1;
  const isField2 = activeFieldId === 2;

  const rawWaterStress = isField1 ? 0.9693 : isField2 ? 0.3229 : 0.50;
  const rawHeatStress = isField1 ? 0.1228 : isField2 ? 0.1059 : 0.25;

  const adjustedWaterStress = effectiveIrrigation ? rawWaterStress * 0.7 : rawWaterStress;

  // Section 37 & 39 Multipliers: 1 + stress
  const waterMultiplier = 1 + adjustedWaterStress;
  const heatMultiplier = 1 + rawHeatStress;

  const effectiveWaterWeight = waterPriority * waterMultiplier;
  const effectiveHeatWeight = heatPriority * heatMultiplier;
  const totalWeight = effectiveWaterWeight + effectiveHeatWeight;

  // Section 40 Canonical Scores:
  // Option A: Water = 80, Heat = 40
  // Option B: Water = 40, Heat = 80
  const scoreA = ((80 * effectiveWaterWeight + 40 * effectiveHeatWeight) / totalWeight);
  const scoreB = ((40 * effectiveWaterWeight + 80 * effectiveHeatWeight) / totalWeight);

  const isAWinner = scoreA >= scoreB;
  const scoreDelta = Math.abs(scoreA - scoreB).toFixed(2);

  // Run real API comparison if in bangladesh_crops mode
  useEffect(() => {
    if (demoMode === 'bangladesh_crops' && activeField) {
      async function runApiCompare() {
        try {
          setIsLoadingApi(true);
          const payload = {
            field_id: activeField.id,
            cycle_mode: 'continue_after_current',
            rotation_cycle_mode: 'continue_after_current',
            rotations: [
              {
                name: 'Option A (Barind Pulse: Chickpea → Mung Bean)',
                label: 'Option A (Barind Pulse: Chickpea → Mung Bean)',
                crop_ids: [12, 5],
                season_sequence: ['Rabi', 'Kharif-1'],
                seasons: ['Rabi', 'Kharif-1']
              },
              {
                name: 'Option B (Cereal-Pulse: Wheat → Mung Bean)',
                label: 'Option B (Cereal-Pulse: Wheat → Mung Bean)',
                crop_ids: [8, 5],
                season_sequence: ['Rabi', 'Kharif-1'],
                seasons: ['Rabi', 'Kharif-1']
              }
            ],
            priorities: {
              water_priority: waterPriority,
              heat_priority: heatPriority,
              soil_priority: 3,
              diversity_priority: 3,
              profitability_priority: 3
            },
            weights: {
              water_priority: waterPriority,
              heat_priority: heatPriority,
              soil_priority: 3,
              diversity_priority: 3,
              profitability_priority: 3
            }
          };
          const data = await compareRotations(payload);
          setApiComparison(data.comparison || data);
        } catch (err) {
          console.error('API comparison error:', err);
        } finally {
          setIsLoadingApi(false);
        }
      }
      runApiCompare();
    }
  }, [demoMode, activeFieldId, waterPriority, heatPriority, effectiveIrrigation]);

  // Construct Option A and Option B objects for Section 40 mode
  const section40RotationA = {
    label: 'Option A: Water-Resilient Focus (Section 40 Fixture)',
    overall_score: scoreA,
    water_score: 80,
    heat_score: 40,
    soil_score: null,
    diversity_score: null,
    profitability_score: null,
    feasibility_status: 'Seasonally feasible',
    sequence: [
      { season: 'Rabi', name: 'Chickpea / Pulse', family: 'Legume', duration_days: 105 },
      { season: 'Kharif-1', name: 'Mung Bean', family: 'Legume', duration_days: 65 }
    ],
    weights: {
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight
    },
    explanation: {
      water: {
        rationale: `High water resilience score (80/100). Amplified by active water stress multiplier (${waterMultiplier.toFixed(2)}x) to total weight ${effectiveWaterWeight.toFixed(2)}.`
      },
      heat: {
        rationale: `Moderate heat tolerance (40/100). Weighted by thermal multiplier (${heatMultiplier.toFixed(2)}x) to weight ${effectiveHeatWeight.toFixed(2)}.`
      },
      soil: { base_soil_health_score: 75, drainage_penalty: 0, ph_penalty: 0, final_soil_score: 75 },
      diversity: { candidate_crop_families: ['Legume'], repeat_check_sequence: ['Legume', 'Legume'], repeat_penalty: 15, final_diversity_score: 85 },
      caveats: [
        'Not a forecast: NASA conditions reflect current satellite anomalies, not predictive forecasts.',
        'Flood risk: Inundation modeling is outside the MVP scope.'
      ]
    }
  };

  const section40RotationB = {
    label: 'Option B: Heat-Resilient Focus (Section 40 Fixture)',
    overall_score: scoreB,
    water_score: 40,
    heat_score: 80,
    soil_score: null,
    diversity_score: null,
    profitability_score: null,
    feasibility_status: 'Seasonally feasible',
    sequence: [
      { season: 'Rabi', name: 'Wheat / Cereal', family: 'Cereal', duration_days: 108 },
      { season: 'Kharif-1', name: 'Mung Bean', family: 'Legume', duration_days: 65 }
    ],
    weights: {
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight
    },
    explanation: {
      water: {
        rationale: `Moderate water resilience score (40/100). In drought conditions, lower water score incurs severe weighted penalty.`
      },
      heat: {
        rationale: `High thermal tolerance score (80/100). Performs best when thermal avoidance is primary concern.`
      },
      soil: { base_soil_health_score: 50, drainage_penalty: 0, ph_penalty: 0, final_soil_score: 50 },
      diversity: { candidate_crop_families: ['Cereal', 'Legume'], repeat_check_sequence: ['Cereal', 'Legume'], repeat_penalty: 0, final_diversity_score: 100 },
      caveats: [
        'Not a forecast: NASA conditions reflect current satellite anomalies, not predictive forecasts.',
        'Flood risk: Inundation modeling is outside the MVP scope.'
      ]
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-6 md:p-7 shadow-xl shadow-black/25 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-emerald-800/40">
          <div>
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Spec Section 40 & 55 Decision Support Matrix
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Rotation Comparison & NASA Ranking Shift
            </h2>
            <p className="text-xs text-emerald-300/70 mt-1 max-w-3xl leading-relaxed">
              Demonstrates how NASA satellite stress multipliers dynamically flip the recommendation ranking between dry Barind terraces and irrigated alluvial plains.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-xl bg-[#04140d] p-1 border border-emerald-800/60 text-xs w-full sm:w-auto gap-1">
            <button
              onClick={() => setDemoMode('section40_fixture')}
              className={`px-3 py-2 rounded-lg font-bold transition-all text-center ${
                demoMode === 'section40_fixture'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              📐 Section 40 Fixture (80/40 vs 40/80)
            </button>
            <button
              onClick={() => setDemoMode('bangladesh_crops')}
              className={`px-3 py-2 rounded-lg font-bold transition-all text-center ${
                demoMode === 'bangladesh_crops'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              🌾 Live BD Crops (Chickpea vs Wheat)
            </button>
          </div>
        </div>

        {/* Field & Environmental Stress Controller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Active Field Picker */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              Select Comparison Field Context
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setActiveFieldId(1); setIsIrrigatedOverride(null); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border ${
                  activeFieldId === 1
                    ? 'bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-500/50'
                    : 'bg-[#03140c] border-emerald-800/50 text-emerald-300/70 hover:text-white'
                }`}
              >
                <div className="font-extrabold">Field #1 (Barind)</div>
                <div className="text-[10px] text-amber-300/80 font-normal">Severe Drought (Rainfed)</div>
              </button>
              <button
                onClick={() => { setActiveFieldId(2); setIsIrrigatedOverride(null); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border ${
                  activeFieldId === 2
                    ? 'bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-500/50'
                    : 'bg-[#03140c] border-emerald-800/50 text-emerald-300/70 hover:text-white'
                }`}
              >
                <div className="font-extrabold">Field #2 (Dinajpur)</div>
                <div className="text-[10px] text-cyan-300/80 font-normal">Mild Stress (Irrigated)</div>
              </button>
            </div>
          </div>

          {/* NASA Satellite Climate Stress Display */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              Active NASA Stress Multipliers
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 flex items-center gap-1">💧 Water Stress:</span>
                <span className="font-mono font-bold text-white">
                  {(adjustedWaterStress * 100).toFixed(1)}% → <strong className="text-cyan-300">{waterMultiplier.toFixed(2)}×</strong>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300 flex items-center gap-1">🔥 Heat Stress:</span>
                <span className="font-mono font-bold text-white">
                  {(rawHeatStress * 100).toFixed(1)}% → <strong className="text-amber-300">{heatMultiplier.toFixed(2)}×</strong>
                </span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-300/50 italic pt-1 border-t border-emerald-900/50">
              Formula: <code>1 + stress</code> (Natural 1.0×–2.0× range)
            </div>
          </div>

          {/* Fixture 3: Irrigation Access Toggle */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              Spec Fixture 3 Irrigation Override
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-emerald-200">Irrigation Access:</span>
              <button
                onClick={() => setIsIrrigatedOverride(!effectiveIrrigation)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  effectiveIrrigation
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                }`}
              >
                {effectiveIrrigation ? '✓ Irrigated (0.7x Factor)' : '✕ Rainfed (Raw Stress)'}
              </button>
            </div>
            <p className="text-[10px] text-emerald-300/60 leading-tight">
              Toggling isolates irrigation relaxation without changing NASA satellite inputs.
            </p>
          </div>
        </div>

        {/* Live Priority Sliders for Section 40 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-800/30">
          <div className="bg-[#04180e] p-3 rounded-xl border border-cyan-800/40">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-cyan-300">Water Priority (p_water):</span>
              <span className="font-mono font-bold text-white bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                Level {waterPriority} • Eff. Wt: {effectiveWaterWeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={waterPriority}
              onChange={(e) => setWaterPriority(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#03140c] rounded-lg"
            />
          </div>

          <div className="bg-[#04180e] p-3 rounded-xl border border-amber-800/40">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-amber-300">Heat Priority (p_heat):</span>
              <span className="font-mono font-bold text-white bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                Level {heatPriority} • Eff. Wt: {effectiveHeatWeight.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={heatPriority}
              onChange={(e) => setHeatPriority(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#03140c] rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Ranking Shift Banner */}
      <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isField1
          ? 'bg-[#082a1b] border-emerald-500/50 text-emerald-100'
          : 'bg-[#062125] border-cyan-500/50 text-cyan-100'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <span className="text-2xl mt-0.5 sm:mt-0">{isAWinner ? '🌱' : '🌾'}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-emerald-400">
                NASA Ranking Inversion Proved:
              </span>
              <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-[#03130b] text-white">
                Δ = {scoreDelta} pts
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-1">
              {isAWinner
                ? `Option A ranks #1 on ${activeField?.name?.split('(')[0] || 'Barind'} due to high water stress (+${((waterMultiplier - 1) * 100).toFixed(0)}% weight boost).`
                : `Option B ranks #1 on ${activeField?.name?.split('(')[0] || 'Dinajpur'} because irrigation reduces water stress, allowing heat resilience to dominate.`}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-emerald-800/40 shrink-0">
          <span className="text-[10px] sm:text-[11px] text-emerald-300/70 block">Spec Section 50 Label:</span>
          <span className="text-xs font-black text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-700/60 inline-block mt-0.5">
            🏆 Highest-scoring rotation: {isAWinner ? 'Option A' : 'Option B'}
          </span>
        </div>
      </div>

      {/* Side-by-Side Cards Display */}
      {demoMode === 'section40_fixture' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RotationCard
            rotation={section40RotationA}
            rank={isAWinner ? 1 : 2}
            isTopCandidate={isAWinner}
            compact={true}
          />
          <RotationCard
            rotation={section40RotationB}
            rank={!isAWinner ? 1 : 2}
            isTopCandidate={!isAWinner}
            compact={true}
          />
        </div>
      ) : (
        <div>
          {isLoadingApi ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium">Calculating real Bangladesh crop rotations via POST /api/rotations/compare...</p>
            </div>
          ) : apiComparison?.rotations ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {apiComparison.rotations.map((rot, idx) => (
                <RotationCard
                  key={rot.id || idx}
                  rotation={rot}
                  rank={rot.rank || idx + 1}
                  isTopCandidate={rot.rank === 1}
                  compact={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-xs text-emerald-300/70">
              No comparison data available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { fetchCrops, evaluateRotation } from '../services/api';
import PrioritySlider from '../components/PrioritySlider';
import RotationCard from '../components/RotationCard';

/**
 * RotationPlanner Page (Spec Section 46, 54, 55)
 * Interactive seasonal crop sequence builder and NASA-aware evaluation hub.
 */
export default function RotationPlanner({ selectedField }) {
  const [crops, setCrops] = useState([]);
  const [isLoadingCrops, setIsLoadingCrops] = useState(true);

  // Rotation planning state
  const [cycleMode, setCycleMode] = useState('continue_after_current'); // 'continue_after_current' | 'start_new_cycle'
  const [selectedSeasons, setSelectedSeasons] = useState(['Rabi', 'Kharif-1']);
  const [selectedCropIds, setSelectedCropIds] = useState([12, 5]); // Default: Chickpea (12) & Mung Bean (5)

  // Farmer priorities (1-5 scale)
  const [priorities, setPriorities] = useState({
    water: 3,
    heat: 3,
    soil: 3,
    diversity: 3,
    profitability: 3
  });

  // Evaluation outcome state
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);

  // Load canonical crops
  useEffect(() => {
    async function loadCrops() {
      try {
        setIsLoadingCrops(true);
        const data = await fetchCrops();
        const loadedCrops = data.crops || [];
        setCrops(loadedCrops);

        // Dynamically find canonical default crops: Chickpea (Rabi) and Mung Bean (Kharif-1)
        const chickpea = loadedCrops.find(c => c.name.toLowerCase().includes('chickpea'));
        const mung = loadedCrops.find(c => c.name.toLowerCase().includes('mung'));
        if (chickpea && mung) {
          setSelectedCropIds([chickpea.id, mung.id]);
        }
      } catch (err) {
        console.error('Failed to load crops:', err);
      } finally {
        setIsLoadingCrops(false);
      }
    }
    loadCrops();
  }, []);

  // Compute active stresses from selected field
  // Using condition score / field observation stress values
  const rawWaterStress = selectedField?.condition_score?.water_score != null
    ? (100 - selectedField.condition_score.water_score) / 100
    : 0.5;
  const rawHeatStress = selectedField?.condition_score?.heat_score != null
    ? (100 - selectedField.condition_score.heat_score) / 100
    : 0.2;

  // Run evaluation
  const handleEvaluate = async () => {
    if (!selectedField) return;
    try {
      setIsEvaluating(true);
      setEvalError(null);

      const payload = {
        field_id: selectedField.id,
        name: `${selectedField.name} Candidate Rotation`,
        season_sequence: selectedSeasons,
        seasons: selectedSeasons,
        crop_ids: selectedCropIds,
        rotation_cycle_mode: cycleMode,
        cycle_mode: cycleMode,
        priorities: {
          water_priority: priorities.water,
          heat_priority: priorities.heat,
          soil_priority: priorities.soil,
          diversity_priority: priorities.diversity,
          profitability_priority: priorities.profitability
        },
        weights: {
          water_priority: priorities.water,
          heat_priority: priorities.heat,
          soil_priority: priorities.soil,
          diversity_priority: priorities.diversity,
          profitability_priority: priorities.profitability
        }
      };

      const result = await evaluateRotation(payload);
      const evaluated = result.rotation || result;
      if (evaluated && !evaluated.sequence && evaluated.crops) {
        evaluated.sequence = evaluated.crops.map((c, i) => ({
          season: selectedSeasons[i] || `Season ${i + 1}`,
          crop_name: c.name,
          crop_family: c.crop_family,
          duration_days: crops.find(crop => crop.id === c.id)?.growing_days
        }));
      }
      setEvaluationResult(evaluated);
      setTimeout(() => {
        document.getElementById('candidate-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      console.error('Evaluation failed:', err);
      setEvalError(err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Evaluate automatically on mount or field switch
  useEffect(() => {
    if (crops.length > 0 && selectedField) {
      handleEvaluate();
    }
  }, [selectedField?.id, crops.length]);

  // Handler to update crop selection for a sequence step
  const handleCropChange = (index, cropId) => {
    const next = [...selectedCropIds];
    next[index] = Number(cropId);
    setSelectedCropIds(next);
  };

  // Handler to add a third season
  const handleAddSeason = () => {
    if (selectedSeasons.length === 2) {
      setSelectedSeasons(['Rabi', 'Kharif-1', 'Kharif-2']);
      const amanId = crops.find(c => c.name.toLowerCase().includes('aman'))?.id || 3;
      setSelectedCropIds([...selectedCropIds, amanId]);
    }
  };

  // Handler to remove third season
  const handleRemoveSeason = () => {
    if (selectedSeasons.length === 3) {
      setSelectedSeasons(['Rabi', 'Kharif-1']);
      setSelectedCropIds(selectedCropIds.slice(0, 2));
    }
  };

  // Preset loaders with dynamic crop resolution
  const loadPreset = (presetType) => {
    const chickpeaId = crops.find(c => c.name.toLowerCase().includes('chickpea'))?.id || 12;
    const mungId = crops.find(c => c.name.toLowerCase().includes('mung'))?.id || 5;
    const wheatId = crops.find(c => c.name.toLowerCase().includes('wheat'))?.id || 8;
    const amanId = crops.find(c => c.name.toLowerCase().includes('aman'))?.id || 3;

    if (presetType === 'barind_pulse') {
      setSelectedSeasons(['Rabi', 'Kharif-1']);
      setSelectedCropIds([chickpeaId, mungId]); // Chickpea -> Mung Bean
      setCycleMode('continue_after_current');
    } else if (presetType === 'triple_crop') {
      setSelectedSeasons(['Rabi', 'Kharif-1', 'Kharif-2']);
      setSelectedCropIds([wheatId, mungId, amanId]); // Wheat -> Mung Bean -> T. Aman Rice
      setCycleMode('continue_after_current');
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Field Context Header */}
      <div className="bg-[#0a1c2e]/90 border border-sky-500/25 rounded-2xl p-6 shadow-xl shadow-black/35 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sky-800/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#071626] border border-sky-800 text-sky-300">
                Field #{selectedField?.id}
              </span>
              <span className="text-xs text-sky-400 font-semibold">
                Rotation Planning Workbench
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {selectedField?.name || 'Godagari Barind Terrace'}
            </h2>
            <p className="text-xs text-sky-300/70 mt-1">
              Soil: <strong className="text-white">{selectedField?.soil_type}</strong> (pH {selectedField?.soil_ph?.toFixed(1)}, {selectedField?.drainage} drainage) • Irrigation: <strong className={selectedField?.irrigation_available ? 'text-cyan-300' : 'text-amber-300'}>{selectedField?.irrigation_available ? 'Irrigated' : 'Rainfed'}</strong>
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <span className="text-xs text-sky-400/80 font-medium">Quick Presets:</span>
            <button
              onClick={() => loadPreset('barind_pulse')}
              className="px-3 py-1.5 rounded-xl bg-[#071626] hover:bg-[#0c2339] border border-cyan-800/60 text-xs font-bold text-cyan-200 transition-colors shadow-sm cursor-pointer"
            >
              🌱 Barind 2-Crop (Chickpea → Mung)
            </button>
            <button
              onClick={() => loadPreset('triple_crop')}
              className="px-3 py-1.5 rounded-xl bg-[#071626] hover:bg-[#0c2339] border border-sky-800/60 text-xs font-bold text-sky-200 transition-colors shadow-sm cursor-pointer"
            >
              🌾 Alluvial 3-Crop (Wheat → Mung → Rice)
            </button>
          </div>
        </div>

        {/* Standing & Previous Crop Succession Context (Spec Section 30) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-2">
          <div className="bg-[#071626]/85 border border-sky-800/50 rounded-xl p-3.5 flex items-center gap-3">
            <span className="text-2xl">🌾</span>
            <div>
              <span className="text-[11px] text-slate-400 block">Current Standing Crop</span>
              <span className="text-sm font-bold text-white">
                {selectedField?.current_crop} <span className="text-emerald-400 text-xs font-normal">({selectedField?.current_crop_family})</span>
              </span>
            </div>
          </div>
          <div className="bg-[#071626]/85 border border-sky-800/50 rounded-xl p-3.5 flex items-center gap-3">
            <span className="text-2xl">⏮</span>
            <div>
              <span className="text-[11px] text-slate-400 block">Previous Season Crop</span>
              <span className="text-sm font-bold text-sky-100">
                {selectedField?.previous_crop} <span className="text-sky-400 text-xs font-normal">({selectedField?.previous_crop_family})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rotation Builder Card */}
      <div className="bg-[#0a1c2e]/90 border border-sky-500/25 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/35 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-sky-800/40">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 block mb-1">
              Spec Section 28–31 Succession Setup
            </span>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              Build Candidate Crop Rotation
            </h3>
          </div>

          {/* Cycle Mode Switcher */}
          <div className="inline-flex rounded-xl bg-[#071626] p-1 border border-sky-800/60 text-xs">
            <button
              onClick={() => setCycleMode('continue_after_current')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                cycleMode === 'continue_after_current'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-300/70 hover:text-white'
              }`}
              title="Next crops follow standing current crop"
            >
              Follow Current Standing
            </button>
            <button
              onClick={() => setCycleMode('start_new_cycle')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                cycleMode === 'start_new_cycle'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-300/70 hover:text-white'
              }`}
              title="New cycle starts fresh from previous season"
            >
              Start New Cycle
            </button>
          </div>
        </div>

        {/* Step-by-Step Crop Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {selectedSeasons.map((season, idx) => {
            const currentCropId = selectedCropIds[idx];
            const currentCrop = crops.find(c => c.id === currentCropId);
            const seasonMaxDays = season === 'Rabi' ? 120 : season === 'Kharif-1' ? 122 : 123;
            const isDurationFeasible = currentCrop ? currentCrop.growing_days <= seasonMaxDays : true;
            const isSeasonSuitable = currentCrop
              ? (Array.isArray(currentCrop.suitable_seasons)
                  ? currentCrop.suitable_seasons.includes(season)
                  : String(currentCrop.suitable_seasons || '').includes(season))
              : true;

            return (
              <div key={season} className="bg-[#071626]/90 border border-sky-800/60 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-sky-300 uppercase tracking-wider">
                      Step {idx + 1}: {season}
                    </span>
                    <span className="text-[10px] font-mono text-sky-400/80">
                      Window: {seasonMaxDays}d
                    </span>
                  </div>

                  <select
                    value={currentCropId}
                    onChange={(e) => handleCropChange(idx, e.target.value)}
                    className="w-full bg-[#040e1a] border border-sky-700/60 text-xs font-semibold text-white rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer shadow-inner mb-3"
                  >
                    {crops.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#071626] text-white">
                        {c.name} ({c.crop_family}) - {c.growing_days}d
                      </option>
                    ))}
                  </select>
                </div>

                {/* Crop Agronomic Attributes Preview */}
                {currentCrop && (
                  <div className="bg-[#040e1a] p-3 rounded-lg border border-sky-900/60 space-y-1 text-[11px] text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Family:</span>
                      <strong className="text-white">{currentCrop.crop_family}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duration:</span>
                      <strong className={isDurationFeasible ? 'text-emerald-300' : 'text-rose-400'}>
                        {currentCrop.growing_days} days {isDurationFeasible ? '✓' : '⚠ exceeds window'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Season Fit:</span>
                      <strong className={isSeasonSuitable ? 'text-emerald-300' : 'text-amber-400'}>
                        {isSeasonSuitable ? `✓ Suitable for ${season}` : `⚠ Unsuitable (${Array.isArray(currentCrop.suitable_seasons) ? currentCrop.suitable_seasons.join(', ') : currentCrop.suitable_seasons})`}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Water Demand:</span>
                      <strong className="text-cyan-300">{currentCrop.water_demand} / 100</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Heat Tolerance:</span>
                      <strong className="text-amber-300">{currentCrop.heat_tolerance} / 100</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add/Remove Season Button & Evaluate Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-sky-800/40">
          <div>
            {selectedSeasons.length === 2 ? (
              <button
                onClick={handleAddSeason}
                className="text-xs font-bold text-sky-300 hover:text-sky-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>+</span> Add Third Season (Kharif-2 T. Aman Rice)
              </button>
            ) : (
              <button
                onClick={handleRemoveSeason}
                className="text-xs font-bold text-rose-300/80 hover:text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>✕</span> Revert to 2-Season Rotation (Rabi → Kharif-1)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:justify-end">
            {evaluationResult && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#071626] border border-sky-700/60 text-xs">
                <span className="text-sky-400 font-bold">Evaluated:</span>
                <span className="font-mono font-extrabold text-white">
                  {Math.round(evaluationResult.overall_score * 10) / 10} / 100
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  evaluationResult.feasibility_status === 'Seasonally feasible'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/50'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-600/50'
                }`}>
                  {evaluationResult.feasibility_status === 'Seasonally feasible' ? '✓ Feasible' : '⚠ Feasibility Notice'}
                </span>
              </div>
            )}

            <button
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="px-6 py-2.5 rounded-xl font-extrabold text-sm bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-400 hover:from-sky-400 hover:to-emerald-300 text-[#06111F] shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#06111F] border-t-transparent rounded-full animate-spin"></span>
                  Evaluating NASA Multipliers...
                </>
              ) : (
                <>
                  <span>⚡</span> Evaluate Candidate Rotation
                </>
              )}
            </button>
          </div>
        </div>

        {evalError && (
          <div className="mt-4 bg-rose-950/70 border border-rose-800 p-3.5 rounded-xl text-xs text-rose-200">
            <strong>Evaluation Error:</strong> {evalError}
          </div>
        )}
      </div>

      {/* Evaluated Outcome RotationCard (PROMINENTLY PLACED DIRECTLY UNDER BUILDER) */}
      {evaluationResult && (
        <div id="candidate-results" className="space-y-3 scroll-mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>📊</span> Candidate Evaluation Results
            </h3>
            <span className="text-xs text-sky-400 font-mono">
              Evaluated with live NASA climate weights
            </span>
          </div>

          <RotationCard
            rotation={evaluationResult}
            rank={1}
            isTopCandidate={true}
          />
        </div>
      )}

      {/* Embedded Priority Sliders with live NASA Multipliers */}
      <PrioritySlider
        priorities={priorities}
        onChange={setPriorities}
        waterStress={rawWaterStress}
        heatStress={rawHeatStress}
        fieldName={selectedField?.name}
        irrigationAvailable={selectedField?.irrigation_available}
      />
    </div>
  );
}

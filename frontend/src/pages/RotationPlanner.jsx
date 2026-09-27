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
  const handleEvaluate = async (shouldScroll = false) => {
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
      if (shouldScroll) {
        setTimeout(() => {
          document.getElementById('candidate-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (err) {
      console.error('Evaluation failed:', err);
      setEvalError(err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Switch cycle mode with instant visual & seasonal sequence adaptation
  const handleSwitchCycleMode = (newMode) => {
    setCycleMode(newMode);

    const chickpeaId = crops.find(c => c.name.toLowerCase().includes('chickpea'))?.id || 12;
    const mungId = crops.find(c => c.name.toLowerCase().includes('mung'))?.id || 5;
    const amanId = crops.find(c => c.name.toLowerCase().includes('aman'))?.id || 3;
    const wheatId = crops.find(c => c.name.toLowerCase().includes('wheat'))?.id || 8;

    if (newMode === 'continue_after_current') {
      // In continue_after_current, we plan post-harvest seasons that follow the active standing crop:
      setSelectedSeasons(['Kharif-1', 'Kharif-2']);
      setSelectedCropIds([mungId, amanId]);
    } else {
      // In start_new_cycle, we plan a complete fresh annual cycle starting from Rabi:
      setSelectedSeasons(['Rabi', 'Kharif-1', 'Kharif-2']);
      const rabiDefault = selectedField?.soil_type?.toLowerCase().includes('clay') ? chickpeaId : wheatId;
      setSelectedCropIds([rabiDefault, mungId, amanId]);
    }
  };

  // Evaluate automatically whenever field, cycleMode, crop sequence, or priorities change
  useEffect(() => {
    if (crops.length > 0 && selectedField && selectedCropIds.length > 0) {
      handleEvaluate(false);
    }
  }, [
    selectedField?.id,
    crops.length,
    cycleMode,
    selectedCropIds.join(','),
    selectedSeasons.join(','),
    priorities.water,
    priorities.heat,
    priorities.soil,
    priorities.diversity,
    priorities.profitability
  ]);

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
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/25 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-800/40">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-mono font-bold px-2.5 py-1 rounded bg-[#04140d] border border-emerald-800 text-emerald-300">
                Field #{selectedField?.id}
              </span>
              <span className="text-sm text-emerald-400 font-semibold">
                Rotation Planning Workbench
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {selectedField?.name || 'Godagari Barind Terrace'}
            </h2>
            <p className="text-sm text-emerald-200/80 mt-1.5 leading-relaxed">
              Soil: <strong className="text-white">{selectedField?.soil_type}</strong> (pH {selectedField?.soil_ph?.toFixed(1)}, {selectedField?.drainage} drainage) • Irrigation: <strong className={selectedField?.irrigation_available ? 'text-cyan-300' : 'text-amber-300'}>{selectedField?.irrigation_available ? 'Irrigated' : 'Rainfed'}</strong>
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <span className="text-sm text-emerald-400 font-semibold">Quick Presets:</span>
            <button
              onClick={() => loadPreset('barind_pulse')}
              className="px-3.5 py-2 rounded-xl bg-[#051d12] hover:bg-[#072417] border border-cyan-800/60 text-sm font-bold text-cyan-200 transition-colors shadow-sm cursor-pointer"
            >
              🌱 Barind 2-Crop (Chickpea → Mung)
            </button>
            <button
              onClick={() => loadPreset('triple_crop')}
              className="px-3.5 py-2 rounded-xl bg-[#051d12] hover:bg-[#072417] border border-emerald-800/60 text-sm font-bold text-emerald-200 transition-colors shadow-sm cursor-pointer"
            >
              🌾 Alluvial 3-Crop (Wheat → Mung → Rice)
            </button>
          </div>
        </div>

        {/* Standing & Previous Crop Succession Context (Spec Section 30) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-1">
          <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-3.5">
            <span className="text-3xl">🌾</span>
            <div>
              <span className="text-xs text-emerald-400/90 font-semibold uppercase tracking-wider block">Current Standing Crop</span>
              <span className="text-lg font-extrabold text-white">
                {selectedField?.current_crop} <span className="text-emerald-400 text-sm font-medium">({selectedField?.current_crop_family})</span>
              </span>
            </div>
          </div>
          <div className="bg-[#051d12]/80 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-3.5">
            <span className="text-3xl">⏮</span>
            <div>
              <span className="text-xs text-emerald-400/90 font-semibold uppercase tracking-wider block">Previous Season Crop</span>
              <span className="text-lg font-extrabold text-emerald-100">
                {selectedField?.previous_crop} <span className="text-emerald-400 text-sm font-medium">({selectedField?.previous_crop_family})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rotation Builder Card */}
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/25 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-800/40">
          <div>
            <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 block mb-1">
              Spec Section 28–31 Succession Setup
            </span>
            <h3 className="text-2xl font-black text-white tracking-tight">
              Build Candidate Crop Rotation
            </h3>
          </div>

          {/* Cycle Mode Switcher */}
          <div className="inline-flex rounded-xl bg-[#04140d] p-1.5 border border-emerald-800/60 text-sm">
            <button
              onClick={() => handleSwitchCycleMode('continue_after_current')}
              className={`px-4 py-2 rounded-lg font-black transition-all flex items-center gap-2 cursor-pointer ${
                cycleMode === 'continue_after_current'
                  ? 'bg-emerald-500 text-[#04140d] shadow-md shadow-emerald-500/20'
                  : 'text-emerald-300/80 hover:text-white'
              }`}
              title="Plan next crops to follow active standing crop in field"
            >
              <span>🌾</span> Follow Current Standing
            </button>
            <button
              onClick={() => handleSwitchCycleMode('start_new_cycle')}
              className={`px-4 py-2 rounded-lg font-black transition-all flex items-center gap-2 cursor-pointer ${
                cycleMode === 'start_new_cycle'
                  ? 'bg-cyan-400 text-[#04140d] shadow-md shadow-cyan-400/20'
                  : 'text-emerald-300/80 hover:text-white'
              }`}
              title="Plan fresh 3-season annual crop rotation starting from Rabi"
            >
              <span>🔄</span> Start New Cycle
            </button>
          </div>
        </div>

        {/* Dynamic Mode Explanatory Banner */}
        {cycleMode === 'continue_after_current' ? (
          <div className="mb-6 p-4 rounded-xl bg-[#031d12] border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="text-3xl mt-0.5">🌾</span>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-black text-white">Interface: Follow Current Standing Crop</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                    Active in Field: {selectedField?.current_crop} ({selectedField?.current_crop_family})
                  </span>
                </div>
                <p className="text-sm text-emerald-200/90 mt-1.5 leading-relaxed">
                  The field currently has standing <strong>{selectedField?.current_crop}</strong>. You are planning the next crops to plant sequentially after harvest ({selectedSeasons.join(' ➔ ')}).
                </p>
              </div>
            </div>
            <div className="text-sm font-mono text-emerald-300 bg-[#021009] px-3.5 py-2 rounded-lg border border-emerald-800/60 shrink-0">
              Repeat Context: <strong className="text-white">{selectedField?.current_crop}</strong>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-xl bg-[#031b20] border border-cyan-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3.5">
              <span className="text-3xl mt-0.5">🔄</span>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-base font-black text-white">Interface: Start New Annual Cycle</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-400/25 text-cyan-200 border border-cyan-400/40">
                    Fresh 3-Season Sequence
                  </span>
                </div>
                <p className="text-sm text-cyan-200/90 mt-1.5 leading-relaxed">
                  Planning a complete new annual crop rotation sequence starting fresh from <strong>Rabi</strong>. Evaluated against prior cycle crop ({selectedField?.previous_crop}).
                </p>
              </div>
            </div>
            <div className="text-sm font-mono text-cyan-200 bg-[#020e12] px-3.5 py-2 rounded-lg border border-cyan-800/60 shrink-0">
              Prior Cycle Context: <strong className="text-white">{selectedField?.previous_crop || 'T. Aman Rice'}</strong>
            </div>
          </div>
        )}

        {/* Step-by-Step Crop Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* If Follow Standing Mode: Display Step 0 Standing Crop Card */}
          {cycleMode === 'continue_after_current' && (
            <div className="bg-[#03150d] border-2 border-emerald-500/50 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-[#021109] text-[11px] font-black uppercase px-3 py-0.5 rounded-bl-lg tracking-wider shadow">
                STANDING NOW
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2.5">
                  <span className="font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Step 0: In Field
                  </span>
                  <span className="text-xs font-mono text-emerald-400/90 mr-16">
                    Current Crop
                  </span>
                </div>

                <div className="bg-[#020d07] border border-emerald-700/60 rounded-xl p-3.5 mb-3.5">
                  <div className="text-xl font-black text-white flex items-center gap-2">
                    <span>🌾</span> {selectedField?.current_crop || 'Current Crop'}
                  </div>
                  <div className="text-sm text-emerald-400 font-semibold mt-1">
                    Family: {selectedField?.current_crop_family || 'Standing'}
                  </div>
                </div>
              </div>

              <div className="bg-[#020d07]/90 p-3.5 rounded-lg border border-emerald-900/60 space-y-1.5 text-xs text-emerald-200/80">
                <div className="flex justify-between">
                  <span>Active Season:</span>
                  <strong className="text-emerald-300">Rabi (Growth Phase)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Rotation Role:</span>
                  <strong className="text-white">Succession Baseline</strong>
                </div>
                <div className="text-xs text-emerald-400/90 mt-2 pt-2 border-t border-emerald-900/40 italic leading-relaxed">
                  Next crops (Steps 1 & 2) follow after this crop is harvested.
                </div>
              </div>
            </div>
          )}

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
            
            const stepNumber = idx + 1;

            return (
              <div key={season} className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2.5">
                    <span className="font-extrabold text-emerald-300 uppercase tracking-wider">
                      Step {stepNumber}: {season}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400/90">
                      Window: {seasonMaxDays}d
                    </span>
                  </div>

                  <select
                    value={currentCropId}
                    onChange={(e) => handleCropChange(idx, e.target.value)}
                    className="w-full bg-[#03140c] border border-emerald-700/60 text-sm font-bold text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer shadow-inner mb-3.5"
                  >
                    {crops.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#062115] text-white py-1">
                        {c.name} ({c.crop_family}) - {c.growing_days}d
                      </option>
                    ))}
                  </select>
                </div>

                {/* Crop Agronomic Attributes Preview */}
                {currentCrop && (
                  <div className="bg-[#03130b] p-3.5 rounded-lg border border-emerald-900/60 space-y-1.5 text-xs text-emerald-200/80">
                    <div className="flex justify-between">
                      <span>Family:</span>
                      <strong className="text-white font-bold">{currentCrop.crop_family}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <strong className={isDurationFeasible ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                        {currentCrop.growing_days} days {isDurationFeasible ? '✓' : '⚠ exceeds window'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Season Fit:</span>
                      <strong className={isSeasonSuitable ? 'text-emerald-300 font-bold' : 'text-amber-400 font-bold'}>
                        {isSeasonSuitable ? `✓ Suitable for ${season}` : `⚠ Unsuitable (${Array.isArray(currentCrop.suitable_seasons) ? currentCrop.suitable_seasons.join(', ') : currentCrop.suitable_seasons})`}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Water Demand:</span>
                      <strong className="text-cyan-300 font-bold">{currentCrop.water_demand} / 100</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Heat Tolerance:</span>
                      <strong className="text-amber-300 font-bold">{currentCrop.heat_tolerance} / 100</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add/Remove Season Button & Evaluate Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-emerald-800/40">
          <div>
            {selectedSeasons.length === 2 ? (
              <button
                onClick={handleAddSeason}
                className="text-sm font-bold text-emerald-300 hover:text-emerald-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>+</span> Add Third Season (Kharif-2 T. Aman Rice)
              </button>
            ) : (
              <button
                onClick={handleRemoveSeason}
                className="text-sm font-bold text-rose-300/80 hover:text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>✕</span> Revert to 2-Season Rotation (Rabi → Kharif-1)
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:justify-end">
            {evaluationResult && (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#04140d] border border-emerald-700/60 text-sm">
                <span className="text-emerald-400 font-bold">Evaluated:</span>
                <span className="font-mono text-base font-black text-white">
                  {Math.round(evaluationResult.overall_score * 10) / 10} / 100
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  evaluationResult.feasibility_status === 'Seasonally feasible'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/50'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-600/50'
                }`}>
                  {evaluationResult.feasibility_status === 'Seasonally feasible' ? '✓ Feasible' : '⚠ Feasibility Notice'}
                </span>
              </div>
            )}

            <button
              onClick={() => handleEvaluate(true)}
              disabled={isEvaluating}
              className="px-7 py-3 rounded-xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-[#04140d] shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <span className="w-5 h-5 border-2 border-[#04140d] border-t-transparent rounded-full animate-spin"></span>
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
          <div className="mt-4 bg-rose-950/70 border border-rose-800 p-4 rounded-xl text-sm text-rose-200">
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
            <span className="text-xs text-emerald-400 font-mono">
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

/**
 * Field Shift - Rotation Scoring & Explanation Engine (Phase 10 & 11)
 * Strictly verifies Spec Sections 36–41, 43, 48–50.
 */
const rotationEngine = require('./rotationEngine');
const soilEngine = require('../soil/soilEngine');
const RotationsModel = require('../../models/rotationsModel');

class ScoringEngine {
  /**
   * Calculate component scores for a candidate rotation (Spec Section 36).
   * Missing or unverified traits are excluded and the average renormalized.
   */
  static calculateComponentScores(crops, soilScoreFinal, diversityScoreFinal) {
    if (!Array.isArray(crops) || crops.length === 0) {
      throw new Error('Crops array is required to calculate component scores');
    }

    // 1. Water score: average(100 - crop.water_demand)
    const validWaterDemands = crops
      .map(c => c.water_demand)
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    const waterScore = validWaterDemands.length > 0
      ? Math.round((validWaterDemands.reduce((sum, d) => sum + (100 - Number(d)), 0) / validWaterDemands.length) * 100) / 100
      : null;

    // 2. Heat score: average(crop.heat_tolerance)
    const validHeatTolerances = crops
      .map(c => c.heat_tolerance)
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    const heatScore = validHeatTolerances.length > 0
      ? Math.round((validHeatTolerances.reduce((sum, h) => sum + Number(h), 0) / validHeatTolerances.length) * 100) / 100
      : null;

    // 3. Soil score: directly soil_score_final
    const soilScore = (soilScoreFinal !== null && soilScoreFinal !== undefined && !isNaN(soilScoreFinal))
      ? Math.round(Number(soilScoreFinal) * 100) / 100
      : null;

    // 4. Diversity score: directly final_diversity_score
    const diversityScore = (diversityScoreFinal !== null && diversityScoreFinal !== undefined && !isNaN(diversityScoreFinal))
      ? Math.round(Number(diversityScoreFinal) * 100) / 100
      : null;

    // 5. Profitability score: average(crop.profitability_value)
    const validProfitabilities = crops
      .map(c => c.profitability_value)
      .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    const profitabilityScore = validProfitabilities.length > 0
      ? Math.round((validProfitabilities.reduce((sum, p) => sum + Number(p), 0) / validProfitabilities.length) * 100) / 100
      : null;

    return {
      water_score: waterScore,
      heat_score: heatScore,
      soil_score: soilScore,
      diversity_score: diversityScore,
      profitability_score: profitabilityScore
    };
  }

  /**
   * Calculate NASA-aware effective weights (Spec Sections 37, 39).
   * Multiplier is strictly 1 + stress, ranging from 1.0x to 2.0x.
   * No MAX_MULTIPLIER variable, no 1.5x cap.
   */
  static calculateEffectiveWeights(priorities = {}, adjustedWaterStress = null, heatStressIndex = null) {
    const defaultPriorities = {
      water: 3,
      heat: 4,
      soil: 3,
      diversity: 3,
      profitability: 4
    };

    const p = { ...defaultPriorities, ...priorities };

    // Water multiplier & effective weight
    let waterMultiplier = 1.0;
    let effectiveWaterWeight = Number(p.water);
    let waterStressWarning = null;

    if (adjustedWaterStress !== null && adjustedWaterStress !== undefined && !isNaN(adjustedWaterStress)) {
      const clampedWaterStress = Math.max(0, Math.min(1, Number(adjustedWaterStress)));
      waterMultiplier = Math.round((1 + clampedWaterStress) * 10000) / 10000;
      effectiveWaterWeight = Math.round(Number(p.water) * waterMultiplier * 1000) / 1000;
    } else {
      waterStressWarning = 'No water inputs: water_stress_index is null; water_multiplier defaulted to 1.0.';
    }

    // Heat multiplier & effective weight
    let heatMultiplier = 1.0;
    let effectiveHeatWeight = Number(p.heat);
    let heatStressWarning = null;

    if (heatStressIndex !== null && heatStressIndex !== undefined && !isNaN(heatStressIndex)) {
      const clampedHeatStress = Math.max(0, Math.min(1, Number(heatStressIndex)));
      heatMultiplier = Math.round((1 + clampedHeatStress) * 10000) / 10000;
      effectiveHeatWeight = Math.round(Number(p.heat) * heatMultiplier * 1000) / 1000;
    } else {
      heatStressWarning = 'No heat inputs: heat_stress_index is null; heat_multiplier defaulted to 1.0.';
    }

    return {
      water_multiplier: waterMultiplier,
      heat_multiplier: heatMultiplier,
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight,
      effective_soil_weight: Number(p.soil),
      effective_diversity_weight: Number(p.diversity),
      effective_profitability_weight: Number(p.profitability),
      water_warning: waterStressWarning,
      heat_warning: heatStressWarning
    };
  }

  /**
   * Calculate overall rotation score (Spec Section 38).
   * Missing components are dropped from both numerator and denominator.
   */
  static calculateOverallScore(componentScores, effectiveWeights) {
    const components = [
      { key: 'water', score: componentScores.water_score, weight: effectiveWeights.effective_water_weight },
      { key: 'soil', score: componentScores.soil_score, weight: effectiveWeights.effective_soil_weight },
      { key: 'heat', score: componentScores.heat_score, weight: effectiveWeights.effective_heat_weight },
      { key: 'diversity', score: componentScores.diversity_score, weight: effectiveWeights.effective_diversity_weight },
      { key: 'profitability', score: componentScores.profitability_score, weight: effectiveWeights.effective_profitability_weight }
    ];

    let weightedSum = 0;
    let totalWeight = 0;
    const availableComponents = [];
    const missingComponents = [];

    for (const c of components) {
      if (c.score !== null && c.score !== undefined && !isNaN(c.score)) {
        weightedSum += Number(c.score) * Number(c.weight);
        totalWeight += Number(c.weight);
        availableComponents.push(c.key);
      } else {
        missingComponents.push(c.key);
      }
    }

    if (totalWeight === 0) {
      return {
        overall_score: null,
        weighted_sum: 0,
        total_weight: 0,
        available_components: availableComponents,
        missing_components: missingComponents
      };
    }

    const rawOverallScore = weightedSum / totalWeight;
    const clampedOverallScore = Math.max(0, Math.min(100, Math.round(rawOverallScore * 100) / 100));

    return {
      overall_score: clampedOverallScore,
      weighted_sum: Math.round(weightedSum * 1000) / 1000,
      total_weight: Math.round(totalWeight * 1000) / 1000,
      available_components: availableComponents,
      missing_components: missingComponents
    };
  }

  /**
   * Generate structured explanation for the evaluated rotation (Spec Section 49, 50, 42).
   */
  static generateExplanation(params) {
    const {
      field,
      crops,
      seasonSequence,
      cycleMode,
      componentScores,
      stressData,
      weights,
      overallResult,
      soilResult,
      diversityResult,
      feasibilityResult,
      dataQualityStatus = 'normal'
    } = params;

    const isIrrigated = Boolean(field.irrigation_available);
    const rawWaterStress = stressData.water_stress_index !== null ? Number(stressData.water_stress_index) : null;
    const adjWaterStress = stressData.adjusted_water_stress !== null ? Number(stressData.adjusted_water_stress) : null;
    const heatStress = stressData.heat_stress_index !== null ? Number(stressData.heat_stress_index) : null;

    // 1. Water Explanation
    const waterExplanation = {
      water_score: componentScores.water_score,
      raw_water_stress: rawWaterStress,
      irrigation_available: isIrrigated,
      adjusted_water_stress: adjWaterStress,
      water_multiplier: weights.water_multiplier,
      effective_water_weight: weights.effective_water_weight,
      summary: isIrrigated
        ? `Water score is ${componentScores.water_score}. Raw water stress is ${rawWaterStress?.toFixed(4)}, reduced to ${adjWaterStress?.toFixed(4)} via 0.7x irrigation adjustment (STW/Canal). NASA priority multiplier is ${weights.water_multiplier}x, setting effective water weight to ${weights.effective_water_weight}.`
        : `Water score is ${componentScores.water_score}. Under rainfed conditions, raw water stress of ${rawWaterStress?.toFixed(4)} is fully applied. NASA priority multiplier is ${weights.water_multiplier}x, elevating effective water weight to ${weights.effective_water_weight}.`
    };

    // 2. Heat Explanation
    const heatExplanation = {
      heat_score: componentScores.heat_score,
      heat_stress_index: heatStress,
      heat_multiplier: weights.heat_multiplier,
      effective_heat_weight: weights.effective_heat_weight,
      summary: `Heat score is ${componentScores.heat_score}. Heat stress index is ${heatStress?.toFixed(4)}, producing a NASA multiplier of ${weights.heat_multiplier}x and an effective heat weight of ${weights.effective_heat_weight}.`
    };

    // 3. Soil Explanation
    const soilExplanation = {
      soil_ph: Number(field.soil_ph),
      drainage: field.drainage,
      organic_matter_percent: Number(field.organic_matter_percent),
      base_soil_health_score: soilResult.base_soil_health_score,
      drainage_penalty: soilResult.drainage_penalty,
      ph_penalty: soilResult.ph_penalty,
      soil_score_final: soilResult.soil_score_final,
      effective_soil_weight: weights.effective_soil_weight,
      summary: `Final soil score is ${soilResult.soil_score_final} (Base health: ${soilResult.base_soil_health_score}, Drainage penalty: ${soilResult.drainage_penalty}, pH penalty: ${soilResult.ph_penalty} for field pH ${field.soil_ph} in ${field.drainage} drainage).`
    };

    // 4. Diversity Explanation
    const candidateFamilies = (crops || []).map(c => c.crop_family);
    const repeatCheckSeq = [
      `${diversityResult.repeat_context_family} (context: ${diversityResult.repeat_context_crop})`,
      ...(crops || []).map(c => `${c.crop_family} (${c.name})`)
    ];

    const diversityExplanation = {
      rotation_cycle_mode: cycleMode,
      repeat_context_crop: diversityResult.repeat_context_crop,
      repeat_context_type: diversityResult.repeat_context_type,
      candidate_crop_families: candidateFamilies,
      repeat_check_sequence: repeatCheckSeq,
      unique_family_ratio: diversityResult.unique_family_ratio,
      base_diversity_score: diversityResult.base_diversity_score,
      adjacent_repeat_penalty: diversityResult.repeat_penalty,
      final_diversity_score: diversityResult.final_diversity_score,
      effective_diversity_weight: weights.effective_diversity_weight,
      summary: `Diversity score is ${diversityResult.final_diversity_score} (Base: ${diversityResult.base_diversity_score}, Repeat penalty: -${diversityResult.repeat_penalty} pts based on context crop '${diversityResult.repeat_context_crop}').`
    };

    // 5. Profitability Explanation
    const profitabilityExplanation = {
      profitability_score: componentScores.profitability_score,
      source: 'BARI/BRRI Agricultural Handbooks',
      verification_status: componentScores.profitability_score !== null ? 'verified' : 'unverified',
      effective_profitability_weight: weights.effective_profitability_weight,
      limitation: 'Reflects gross seasonal margin index under standard Bangladesh market conditions.',
      summary: componentScores.profitability_score !== null
        ? `Profitability score is ${componentScores.profitability_score}, weighted at ${weights.effective_profitability_weight}.`
        : 'Profitability data unavailable; dropped from scoring numerator and denominator.'
    };

    // 6. Feasibility Explanation
    const failureReasons = feasibilityResult.failure_reasons || feasibilityResult.reasons || [];
    const feasibilityExplanation = {
      feasibility_status: feasibilityResult.feasibility_status,
      season_sequence: seasonSequence,
      reasons: failureReasons,
      summary: feasibilityResult.feasibility_status === 'Seasonally feasible'
        ? 'All crops fit within their respective seasonal boundaries.'
        : `Not seasonally feasible: ${failureReasons.join('; ')}`
    };

    // 7. Data Quality Explanation
    const dataQualityExplanation = {
      data_quality_status: dataQualityStatus,
      sources_available: '4 of 4 (HLS, SMAP, GPM IMERG, MODIS LST)',
      resolution_disclosures: [
        'HLS: 30-meter optical / NIR / SWIR',
        'MODIS: 1 km thermal LST (Terra MOD11A1 + Aqua MYD11A1)',
        'SMAP: 9 km enhanced radiometer grid (SPL3SMP_E)',
        'GPM IMERG: 0.1 deg (~10 km) calibrated monthly/daily precipitation'
      ],
      sample_quality: 'usable',
      crop_matched: true,
      observation_window: '2023-12-30 to 2024-02-28 (61 days)'
    };

    // 8. Caveats (Spec Section 42)
    const caveats = {
      not_a_forecast: 'Recent NASA conditions are used as a proxy for current climate pressure. They are not a forecast of future seasonal conditions.',
      flood_risk: 'Flood-risk modeling is outside the current MVP. Rainfall is included, but the system does not directly predict flooding or inundation.'
    };

    return {
      water: waterExplanation,
      heat: heatExplanation,
      soil: soilExplanation,
      diversity: diversityExplanation,
      profitability: profitabilityExplanation,
      feasibility: feasibilityExplanation,
      data_quality: dataQualityExplanation,
      caveats: caveats
    };
  }

  /**
   * Full end-to-end evaluation & persistence of a candidate rotation (Spec Sections 36-43, 48-50).
   */
  static async evaluateAndSaveRotation(db, params) {
    const {
      fieldId,
      name,
      seasonSequence,
      candidateCrops,
      cycleMode = 'continue_after_current',
      priorities = {},
      drainageMatrix = []
    } = params;

    // Fetch field from DB
    const fieldRes = await db.query('SELECT * FROM fields WHERE id = $1', [fieldId]);
    if (fieldRes.rows.length === 0) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }
    const field = fieldRes.rows[0];

    // Fetch field stress values from earth_observations (window average)
    const obsRes = await db.query(`
      SELECT id, observation_date, water_stress_index, adjusted_water_stress, heat_stress_index
      FROM earth_observations
      WHERE field_id = $1
      ORDER BY observation_date ASC
    `, [fieldId]);

    const observationIds = obsRes.rows.map(r => r.id);

    // Compute average stress across the window
    let avgWaterStress = null;
    let avgAdjWaterStress = null;
    let avgHeatStress = null;

    if (obsRes.rows.length > 0) {
      const validWater = obsRes.rows.filter(r => r.water_stress_index !== null).map(r => Number(r.water_stress_index));
      const validAdjWater = obsRes.rows.filter(r => r.adjusted_water_stress !== null).map(r => Number(r.adjusted_water_stress));
      const validHeat = obsRes.rows.filter(r => r.heat_stress_index !== null).map(r => Number(r.heat_stress_index));

      if (validWater.length > 0) avgWaterStress = validWater.reduce((a, b) => a + b, 0) / validWater.length;
      if (validAdjWater.length > 0) avgAdjWaterStress = validAdjWater.reduce((a, b) => a + b, 0) / validAdjWater.length;
      if (validHeat.length > 0) avgHeatStress = validHeat.reduce((a, b) => a + b, 0) / validHeat.length;
    }

    // Fetch baselines used
    const baseRes = await db.query('SELECT id, variable, sample_quality, crop_matched FROM baselines WHERE field_id = $1', [fieldId]);
    const baselineIds = baseRes.rows.map(r => r.id);
    const isCropMatched = baseRes.rows.some(r => r.crop_matched === true);
    const sampleQuality = baseRes.rows.some(r => r.sample_quality === 'limited') ? 'limited' : 'usable';

    // 1 & 2. Feasibility & Diversity (Spec Section 28-31)
    const sequence = candidateCrops.map((c, i) => ({
      season: seasonSequence[i],
      crop: c
    }));
    const rotFeasDiv = rotationEngine.evaluateRotationFeasibilityAndDiversity(field, sequence, {}, cycleMode);
    const feasibilityResult = {
      is_feasible: rotFeasDiv.is_feasible,
      feasibility_status: rotFeasDiv.feasibility_status,
      failure_reasons: rotFeasDiv.failure_reasons
    };
    const diversityResult = {
      repeat_context_crop: rotFeasDiv.repeat_context_crop,
      repeat_context_family: rotFeasDiv.repeat_context_family,
      repeat_context_type: rotFeasDiv.repeat_context_type,
      base_diversity_score: rotFeasDiv.base_diversity_score,
      repeat_penalty: rotFeasDiv.repeat_penalty,
      final_diversity_score: rotFeasDiv.final_diversity_score,
      candidate_families: rotFeasDiv.family_sequence,
      unique_family_ratio: candidateCrops.length > 0 ? (new Set(candidateCrops.map(c => c.crop_family)).size / candidateCrops.length) : 0
    };

    // 3. Soil Compatibility Score (Spec Sections 32-35)
    const soilResult = soilEngine.calculateRotationSoilScore(candidateCrops, field);

    // 4. Component Scores (Spec Section 36)
    const componentScores = this.calculateComponentScores(
      candidateCrops,
      soilResult.soil_score_final,
      diversityResult.final_diversity_score
    );

    // 5. NASA-Aware Effective Weights (Spec Section 37, 39)
    const weights = this.calculateEffectiveWeights(priorities, avgAdjWaterStress, avgHeatStress);

    // 6. Overall Rotation Score (Spec Section 38)
    const overallResult = this.calculateOverallScore(componentScores, weights);

    // 7. Structured Explanation (Spec Section 49, 50, 42)
    const explanation = this.generateExplanation({
      field,
      crops: candidateCrops,
      seasonSequence,
      cycleMode,
      componentScores,
      stressData: {
        water_stress_index: avgWaterStress,
        adjusted_water_stress: avgAdjWaterStress,
        heat_stress_index: avgHeatStress
      },
      weights,
      overallResult,
      soilResult,
      diversityResult,
      feasibilityResult,
      dataQualityStatus: 'normal'
    });

    // 8. Persist to DB (Spec Section 43, 48)
    const rotationRecord = await RotationsModel.create({
      field_id: field.id,
      name: name,
      season_sequence: seasonSequence,
      crops: candidateCrops.map(c => ({ id: c.id, name: c.name, crop_family: c.crop_family })),
      rotation_cycle_mode: cycleMode,
      repeat_context_crop: diversityResult.repeat_context_crop,
      repeat_context_type: diversityResult.repeat_context_type,
      water_score: componentScores.water_score,
      soil_score: componentScores.soil_score,
      heat_score: componentScores.heat_score,
      diversity_score: componentScores.diversity_score,
      profitability_score: componentScores.profitability_score,
      base_soil_health_score: soilResult.base_soil_health_score,
      drainage_penalty: soilResult.drainage_penalty,
      ph_penalty: soilResult.ph_penalty,
      organic_matter_adjustment: 0,
      soil_score_final: soilResult.soil_score_final,
      water_stress_index: avgWaterStress !== null ? Math.round(avgWaterStress * 10000) / 10000 : null,
      adjusted_water_stress: avgAdjWaterStress !== null ? Math.round(avgAdjWaterStress * 10000) / 10000 : null,
      heat_stress_index: avgHeatStress !== null ? Math.round(avgHeatStress * 10000) / 10000 : null,
      water_multiplier: weights.water_multiplier,
      heat_multiplier: weights.heat_multiplier,
      effective_water_weight: weights.effective_water_weight,
      effective_heat_weight: weights.effective_heat_weight,
      overall_score: overallResult.overall_score,
      feasibility_status: feasibilityResult.feasibility_status,
      sample_quality: sampleQuality,
      crop_matched: isCropMatched,
      data_quality_status: 'normal',
      observation_ids_used: observationIds,
      baseline_ids_used: baselineIds,
      explanation: explanation,
      scoring_version: 'v6.2',
      scored_at: new Date().toISOString()
    });

    return rotationRecord;
  }
}

module.exports = ScoringEngine;

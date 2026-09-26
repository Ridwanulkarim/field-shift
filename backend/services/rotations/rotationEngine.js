/**
 * Field Shift - Rotation Feasibility & Cycle Engine (Phase 9)
 * Strictly implements:
 * - Spec Section 28: Bangladesh Seasons (Kharif-1 122d, Kharif-2 123d, Rabi 120d)
 * - Spec Section 29: Rotation Semantics & Seasonal Feasibility (suitable_seasons & growing_days <= available_season_days)
 * - Spec Section 30: Rotation Cycle Context ('continue_after_current' vs 'start_new_cycle')
 * - Spec Section 31: Diversity Score (unique family ratio * 100 - 15 pts per adjacent repeat)
 */

class RotationEngine {
  /**
   * Evaluates seasonal feasibility of a candidate rotation sequence (Spec Section 29).
   * A crop is seasonally feasible only if:
   * 1. selected_season is in crop.suitable_seasons
   * 2. growing_days <= available_season_days
   * 
   * @param {Array<Object>} sequence - Array of { season: 'Rabi'|'Kharif-1'|'Kharif-2', crop: Object }
   * @param {Map|Object} seasonsMap - Map of season name -> { approx_days, name }
   * @returns {Object} { is_feasible, feasibility_status, failure_reasons, crop_evaluations }
   */
  checkSeasonalFeasibility(sequence = [], seasonsMap = {}) {
    if (!sequence || sequence.length === 0) {
      return {
        is_feasible: false,
        feasibility_status: 'Not seasonally feasible',
        failure_reasons: ['No crops provided in rotation sequence'],
        crop_evaluations: []
      };
    }

    const defaultSeasonDays = {
      'Rabi': 120,
      'Kharif-1': 122,
      'Kharif-2': 123
    };

    const failureReasons = [];
    const cropEvaluations = [];

    for (const item of sequence) {
      const seasonName = item.season;
      const crop = item.crop;

      const seasonObj = seasonsMap[seasonName] || (seasonsMap.get && seasonsMap.get(seasonName));
      const availableDays = seasonObj ? Number(seasonObj.approx_days) : (defaultSeasonDays[seasonName] || 120);

      let suitableSeasons = crop.suitable_seasons;
      if (typeof suitableSeasons === 'string') {
        try {
          suitableSeasons = JSON.parse(suitableSeasons);
        } catch {
          suitableSeasons = [suitableSeasons];
        }
      }
      if (!Array.isArray(suitableSeasons)) {
        suitableSeasons = [];
      }

      const isSeasonSuitable = suitableSeasons.includes(seasonName);
      const isDaysFeasible = Number(crop.growing_days) <= availableDays;

      const itemFailures = [];
      if (!isSeasonSuitable) {
        itemFailures.push(`${crop.name} is not suitable for season ${seasonName} (suitable: ${suitableSeasons.join(', ')})`);
      }
      if (!isDaysFeasible) {
        itemFailures.push(`${crop.name} growing days (${crop.growing_days}d) exceeds ${seasonName} duration (${availableDays}d)`);
      }

      if (itemFailures.length > 0) {
        failureReasons.push(...itemFailures);
      }

      cropEvaluations.push({
        crop_name: crop.name,
        season: seasonName,
        growing_days: crop.growing_days,
        available_days: availableDays,
        is_season_suitable: isSeasonSuitable,
        is_days_feasible: isDaysFeasible,
        feasible: itemFailures.length === 0,
        failures: itemFailures
      });
    }

    const isFeasible = failureReasons.length === 0;

    return {
      is_feasible: isFeasible,
      feasibility_status: isFeasible ? 'Seasonally feasible' : 'Not seasonally feasible',
      failure_reasons: failureReasons,
      crop_evaluations: cropEvaluations
    };
  }

  /**
   * Determines the repeat context crop and type based on field and cycle mode (Spec Section 30).
   * 
   * @param {Object} field - Field metadata { current_crop, current_crop_family, previous_crop, previous_crop_family }
   * @param {string} cycleMode - 'continue_after_current' or 'start_new_cycle'
   * @returns {Object} { repeat_context_crop, repeat_context_family, repeat_context_type }
   */
  getRepeatContext(field = {}, cycleMode = 'continue_after_current') {
    if (cycleMode === 'start_new_cycle') {
      return {
        repeat_context_crop: field.previous_crop || 'Unknown',
        repeat_context_family: field.previous_crop_family || 'Unknown',
        repeat_context_type: 'previous'
      };
    }

    // Default: 'continue_after_current'
    return {
      repeat_context_crop: field.current_crop || 'Unknown',
      repeat_context_family: field.current_crop_family || 'Unknown',
      repeat_context_type: 'current'
    };
  }

  /**
   * Computes the Diversity Score with adjacent family repeat penalties (Spec Section 31).
   * 
   * Formula:
   * unique_family_ratio = unique_crop_families / number_of_rotation_crops
   * base_diversity_score = unique_family_ratio * 100
   * repeat_penalty = 15 * count_of_adjacent_repeated_families in [repeat_context, ...candidate_crops]
   * final_diversity_score = clamp(base_diversity_score - repeat_penalty, 0, 100)
   * 
   * @param {Array<Object>} candidateCrops - Array of crop records in candidate rotation
   * @param {string} repeatContextFamily - Crop family of the repeat context
   * @returns {Object} { base_diversity_score, repeat_penalty, adjacent_repeats, final_diversity_score, sequence }
   */
  calculateDiversityScore(candidateCrops = [], repeatContextFamily = null) {
    if (!candidateCrops || candidateCrops.length === 0) {
      return {
        base_diversity_score: 0.0,
        repeat_penalty: 0.0,
        adjacent_repeats: 0,
        final_diversity_score: 0.0,
        unique_families_count: 0,
        total_rotation_crops: 0,
        sequence: []
      };
    }

    const totalCrops = candidateCrops.length;
    const candidateFamilies = candidateCrops.map(c => c.crop_family);
    const uniqueFamilies = new Set(candidateFamilies);
    const uniqueFamiliesCount = uniqueFamilies.size;

    // Spec Section 31: Ratio computed from candidate rotation only
    const uniqueFamilyRatio = uniqueFamiliesCount / totalCrops;
    const base_diversity_score = Math.round(uniqueFamilyRatio * 100 * 10) / 10;

    // Adjacent repeat penalty: build repeat_context_crop + candidate_rotation
    const sequence = repeatContextFamily ? [repeatContextFamily, ...candidateFamilies] : [...candidateFamilies];
    let adjacentRepeats = 0;

    for (let i = 0; i < sequence.length - 1; i++) {
      if (sequence[i] && sequence[i + 1] && sequence[i] === sequence[i + 1]) {
        adjacentRepeats++;
      }
    }

    const repeat_penalty = adjacentRepeats * 15.0;
    const final_diversity_score = Math.max(0, Math.min(100, Math.round((base_diversity_score - repeat_penalty) * 10) / 10));

    return {
      base_diversity_score,
      repeat_penalty,
      adjacent_repeats: adjacentRepeats,
      final_diversity_score,
      unique_families_count: uniqueFamiliesCount,
      total_rotation_crops: totalCrops,
      sequence
    };
  }

  /**
   * Complete candidate rotation evaluation for Phase 9.
   * Combines cycle context, seasonal feasibility, and diversity scoring.
   * 
   * @param {Object} field - Field record
   * @param {Array<Object>} sequence - Array of { season, crop }
   * @param {Map|Object} seasonsMap 
   * @param {string} cycleMode - 'continue_after_current' or 'start_new_cycle'
   * @returns {Object}
   */
  evaluateRotationFeasibilityAndDiversity(field, sequence = [], seasonsMap = {}, cycleMode = 'continue_after_current') {
    // 1. Cycle Context
    const repeatContext = this.getRepeatContext(field, cycleMode);

    // 2. Seasonal Feasibility
    const feasibility = this.checkSeasonalFeasibility(sequence, seasonsMap);

    // 3. Diversity Score
    const crops = sequence.map(s => s.crop);
    const diversity = this.calculateDiversityScore(crops, repeatContext.repeat_context_family);

    return {
      field_id: field.id,
      field_name: field.name,
      rotation_cycle_mode: cycleMode,
      repeat_context_crop: repeatContext.repeat_context_crop,
      repeat_context_family: repeatContext.repeat_context_family,
      repeat_context_type: repeatContext.repeat_context_type,
      is_feasible: feasibility.is_feasible,
      feasibility_status: feasibility.feasibility_status,
      failure_reasons: feasibility.failure_reasons,
      crop_evaluations: feasibility.crop_evaluations,
      base_diversity_score: diversity.base_diversity_score,
      repeat_penalty: diversity.repeat_penalty,
      adjacent_repeats: diversity.adjacent_repeats,
      final_diversity_score: diversity.final_diversity_score,
      family_sequence: diversity.sequence
    };
  }
}

module.exports = new RotationEngine();

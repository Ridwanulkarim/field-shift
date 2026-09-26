/**
 * Field Shift - Soil Compatibility Engine (Phase 8)
 * Strictly implements:
 * - Spec Section 32: Soil Compatibility & Base Soil Health Score
 * - Spec Section 33: Drainage Penalty Mapping (3x3 Matrix with Unknown Tolerance Handling)
 * - Spec Section 34: pH Penalty Mapping (10 pts per pH unit outside verified range, max 20)
 * - Spec Section 35: Final Soil Score Calculation & Quality Flag
 */

// Spec Section 33 3x3 Drainage Penalty Matrix
const DRAINAGE_PENALTY_MATRIX = {
  low: { good: 0, moderate: 10, poor: 20 },
  medium: { good: 0, moderate: 5, poor: 10 },
  high: { good: 0, moderate: 0, poor: 0 }
};

class SoilEngine {
  /**
   * Computes the drainage penalty for an individual crop given field drainage (Spec Section 33).
   * 
   * @param {string|null} waterloggingTolerance - 'Low', 'Medium', 'High' or null/unknown
   * @param {string} fieldDrainage - 'good', 'moderate', 'poor'
   * @returns {number|null} Penalty points (0, 5, 10, 20) or null if unknown
   */
  calculateCropDrainagePenalty(waterloggingTolerance, fieldDrainage) {
    if (!waterloggingTolerance || typeof waterloggingTolerance !== 'string') {
      return null; // Unknown tolerance gives null: never treat as zero (Section 33)
    }

    const tol = waterloggingTolerance.trim().toLowerCase();
    const drain = (fieldDrainage || 'good').trim().toLowerCase();

    if (!DRAINAGE_PENALTY_MATRIX[tol] || DRAINAGE_PENALTY_MATRIX[tol][drain] === undefined) {
      return null;
    }

    return DRAINAGE_PENALTY_MATRIX[tol][drain];
  }

  /**
   * Computes pH penalty for an individual crop given field soil pH (Spec Section 34).
   * pH_units_outside_range = 0 if within range, else distance to nearest bound.
   * ph_penalty = min(20, 10 * pH_units_outside_range).
   * 
   * @param {number} fieldPh 
   * @param {number|null} minPh 
   * @param {number|null} maxPh 
   * @returns {number|null} Penalty points (0 to 20) or null if unknown
   */
  calculateCropPhPenalty(fieldPh, minPh, maxPh) {
    if (fieldPh == null || isNaN(fieldPh) || minPh == null || isNaN(minPh) || maxPh == null || isNaN(maxPh)) {
      return null; // Unknown range gives null: skip and flag as limited, do not invent penalties (Section 34)
    }

    const ph = Number(fieldPh);
    const min = Number(minPh);
    const max = Number(maxPh);

    if (ph >= min && ph <= max) {
      return 0.0;
    }

    let distance = 0.0;
    if (ph < min) {
      distance = min - ph;
    } else {
      distance = ph - max;
    }

    const penalty = Math.min(20, 10 * distance);
    return Math.round(penalty * 100) / 100;
  }

  /**
   * Computes Soil Health Benefit, Drainage Penalty, pH Penalty, and Final Soil Score
   * for a candidate crop rotation on a specific field (Spec Sections 32-35).
   * 
   * @param {Array<Object>} cropsList - Array of crop records
   * @param {Object} field - Field metadata { id, name, drainage, soil_ph, organic_matter_percent }
   * @returns {Object} { base_soil_health_score, drainage_penalty, ph_penalty, organic_matter_adjustment, soil_score_final, quality_flag, crop_penalties, explanation }
   */
  calculateRotationSoilScore(cropsList = [], field = {}) {
    if (!cropsList || cropsList.length === 0) {
      return {
        base_soil_health_score: null,
        drainage_penalty: null,
        ph_penalty: null,
        organic_matter_adjustment: 0.0,
        soil_score_final: null,
        quality_flag: 'limited',
        crop_penalties: [],
        explanation: 'No crops specified in candidate rotation.'
      };
    }

    const cropPenalties = [];
    const baseHealthValues = [];
    const knownDrainagePenalties = [];
    const knownPhPenalties = [];
    let hasLimitedData = false;

    for (const crop of cropsList) {
      // 1. Base Soil Health Benefit
      const benefit = crop.soil_health_benefit != null ? Number(crop.soil_health_benefit) : null;
      if (benefit != null && !isNaN(benefit)) {
        baseHealthValues.push(benefit);
      } else {
        hasLimitedData = true;
      }

      // 2. Crop Drainage Penalty
      const cropDrainPenalty = this.calculateCropDrainagePenalty(crop.waterlogging_tolerance, field.drainage);
      if (cropDrainPenalty !== null) {
        knownDrainagePenalties.push(cropDrainPenalty);
      } else {
        hasLimitedData = true;
      }

      // 3. Crop pH Penalty
      const cropPhPenalty = this.calculateCropPhPenalty(field.soil_ph, crop.min_soil_ph, crop.max_soil_ph);
      if (cropPhPenalty !== null) {
        knownPhPenalties.push(cropPhPenalty);
      } else {
        hasLimitedData = true;
      }

      cropPenalties.push({
        crop_name: crop.name,
        soil_health_benefit: benefit,
        waterlogging_tolerance: crop.waterlogging_tolerance,
        drainage_penalty: cropDrainPenalty,
        min_soil_ph: crop.min_soil_ph,
        max_soil_ph: crop.max_soil_ph,
        ph_penalty: cropPhPenalty
      });
    }

    // Spec Section 32: rotation_soil_health_score = average(crop soil_health_benefit)
    const base_soil_health_score = baseHealthValues.length > 0
      ? Math.round((baseHealthValues.reduce((s, v) => s + v, 0) / baseHealthValues.length) * 100) / 100
      : null;

    // Spec Section 33: Rotation drainage penalty is average across crops with known tolerance
    const drainage_penalty = knownDrainagePenalties.length > 0
      ? Math.round((knownDrainagePenalties.reduce((s, v) => s + v, 0) / knownDrainagePenalties.length) * 100) / 100
      : null;

    // Spec Section 34: Rotation pH penalty is average across crops with known ranges
    const ph_penalty = knownPhPenalties.length > 0
      ? Math.round((knownPhPenalties.reduce((s, v) => s + v, 0) / knownPhPenalties.length) * 100) / 100
      : null;

    // Spec Section 32: Organic matter has no numeric effect unless reliable evidence supports one
    const organic_matter_adjustment = 0.0;

    // Spec Section 35: soil_score_final = clamp(rotation_soil_health_score - drainage_penalty - ph_penalty, 0, 100)
    // Only available penalties are subtracted.
    let soil_score_final = null;
    if (base_soil_health_score !== null) {
      const subtracted = (drainage_penalty || 0) + (ph_penalty || 0);
      soil_score_final = Math.max(0, Math.min(100, Math.round((base_soil_health_score - subtracted + organic_matter_adjustment) * 100) / 100));
    }

    const quality_flag = (hasLimitedData || drainage_penalty === null || ph_penalty === null) ? 'limited' : 'usable';

    // Build human-readable agronomic explanation
    const explanationParts = [];
    explanationParts.push(`Base soil health: ${base_soil_health_score ?? 'N/A'}`);
    if (drainage_penalty !== null) {
      explanationParts.push(`drainage penalty: -${drainage_penalty} pts (${field.drainage} drainage)`);
    } else {
      explanationParts.push('drainage penalty: limited (unknown tolerance)');
    }
    if (ph_penalty !== null) {
      explanationParts.push(`pH penalty: -${ph_penalty} pts (field pH ${field.soil_ph})`);
    } else {
      explanationParts.push('pH penalty: limited (unknown pH range)');
    }
    explanationParts.push(`final soil score: ${soil_score_final ?? 'N/A'}`);

    return {
      base_soil_health_score,
      drainage_penalty,
      ph_penalty,
      organic_matter_adjustment,
      soil_score_final,
      quality_flag,
      crop_penalties: cropPenalties,
      explanation: explanationParts.join(', ')
    };
  }
}

module.exports = new SoilEngine();

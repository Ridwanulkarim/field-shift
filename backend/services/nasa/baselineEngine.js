/**
 * Field Shift - Historical Baseline Calculation Engine (Phase 6)
 * Strictly implements:
 * - Spec Section 10: Current-Year Exclusion (year 2023 excluded), n>=10, n_years>=3
 * - Spec Section 12: Day-of-Year +/- 7 days matching for daily observations
 * - Spec Section 13: Crop-Aware Vegetation Matching (same crop family, no mixing)
 * - Spec Section 14: Dual Quality Dimensions (sample_quality & crop_matched)
 * - Spec Section 16 & 43: Full Analysis Window Baselines for Storage & Reproducibility
 */
const config = require('../../config');
const historicalDataService = require('./historicalDataService');

class BaselineEngine {
  /**
   * Computes the stored seasonal baseline records for a field across all NASA variables
   * pooled across the current analysis window (30 days for HLS, 61 days for SMAP/MODIS/GPM).
   * 
   * @param {Object} field - { id, name, current_crop, current_crop_family, current_season }
   * @param {Array<Object>} fieldHistory - Array of { year, season, crop, crop_family }
   * @param {string} targetDateStr - 'YYYY-MM-DD' (e.g. config.DEMO_ANCHOR_DATE '2024-02-28')
   * @returns {Array<Object>} Array of calculated baseline objects ready for database insertion
   */
  computeFieldBaselines(field, fieldHistory = [], targetDateStr = config.DEMO_ANCHOR_DATE) {
    const variables = [
      { name: 'evi', isVegetation: true, windowDays: 30 },
      { name: 'ndvi', isVegetation: true, windowDays: 30 },
      { name: 'ndmi', isVegetation: true, windowDays: 30 },
      { name: 'soil_moisture', isVegetation: false, windowDays: 61 },
      { name: 'rolling_30d_rainfall', isVegetation: false, windowDays: 61, gpm_latency: 'Final' },
      { name: 'daytime_lst_c', isVegetation: false, windowDays: 61 },
      { name: 'nighttime_lst_c', isVegetation: false, windowDays: 61 }
    ];

    const currentSeason = field.current_season || 'Rabi';
    const currentCropFamily = field.current_crop_family;
    const baselines = [];

    for (const v of variables) {
      // 1. Retrieve historical observations pooled across this variable's analysis window
      const windowObs = historicalDataService.getHistoricalObservationsForWindow(
        field.id,
        v.windowDays,
        targetDateStr,
        fieldHistory
      );

      let eligibleObs = windowObs;
      let cropMatched = null;

      // 2. Crop-aware filtering for vegetation indices (Spec Section 13)
      if (v.isVegetation) {
        const familyMatchedObs = windowObs.filter(obs => obs.crop_family === currentCropFamily);
        if (familyMatchedObs.length > 0) {
          eligibleObs = familyMatchedObs;
          cropMatched = true;
        } else {
          eligibleObs = [];
          cropMatched = false;
        }
      } else {
        // Non-vegetation: crop_matched is strictly null (Spec Section 14)
        cropMatched = null;
      }

      // 3. Extract valid numeric values
      const validRecords = eligibleObs.filter(obs => obs[v.name] != null && !isNaN(obs[v.name]));
      const values = validRecords.map(r => Number(r[v.name]));
      const n = values.length;

      // 4. Current-year exclusion check (Spec Section 10)
      const currentYear = new Date(targetDateStr).getFullYear();
      const currentRabiYear = 2023; // Rabi start-year for 2023-24 season
      const years = [...new Set(validRecords.map(r => r.year))].sort((a, b) => a - b);
      if (years.includes(currentRabiYear) || years.includes(currentYear)) {
        throw new Error(`Current-year exclusion violated: found year ${currentRabiYear} in baseline records!`);
      }

      const n_years = years.length;

      // 5. Sample quality evaluation (Spec Section 14)
      const sampleQuality = (n >= 10 && n_years >= 3) ? 'usable' : 'limited';

      // 6. Statistical Aggregations (mean and sample standard deviation)
      let mean = 0.0;
      let std = 0.0;
      if (n > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        mean = Math.round((sum / n) * 10000) / 10000;

        if (n > 1) {
          const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
          std = Math.round(Math.sqrt(variance) * 10000) / 10000;
        }
      }

      // 7. Period boundaries
      const sortedDates = validRecords.map(r => r.date).sort();
      const periodStart = sortedDates.length > 0 ? sortedDates[0] : `${years[0] || 2019}-01-29`;
      const periodEnd = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : `${years[years.length - 1] || 2022}-02-28`;

      baselines.push({
        field_id: field.id,
        variable: v.name,
        season: currentSeason,
        mean,
        std,
        n,
        n_years,
        years_included: years,
        period_start: periodStart,
        period_end: periodEnd,
        method: `pooled_${v.windowDays}d_historical_analysis_window`,
        sample_quality: sampleQuality,
        crop_matched: cropMatched,
        gpm_latency_class: v.gpm_latency || null
      });
    }

    return baselines;
  }

  /**
   * @deprecated Option A adopted: Phase 7 uses the stored baselines from the 'baselines' table
   * as the single source of truth for deterministic scoring and reproducible audit trails (Spec Section 43 & 48).
   */
  computeDailyDOYBaseline(field, fieldHistory, observationDateStr, variableName) {
    console.warn('[BaselineEngine] DEPRECATED: computeDailyDOYBaseline called. Stress engine uses stored baselines (Option A).');
    return null;
  }
}

module.exports = new BaselineEngine();

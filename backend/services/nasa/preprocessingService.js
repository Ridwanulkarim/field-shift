/**
 * Field Shift - NASA Preprocessing & Ingestion Service (Spec Section 8, 9, 16, 24, 43)
 * Handles:
 * - QA / cloud filtering for HLS (HLSL30/HLSS30) with adaptive 30d -> 60d fallback
 * - GPM IMERG 90-day ingestion, rolling 30-day cumulative precipitation, dry-day count
 * - MODIS LST Kelvin-to-Celsius conversion (scale factor 0.02) and QC filtering for Terra (MOD11A1) & Aqua (MYD11A1)
 * - SMAP (SPL3SMP_E.006) 9 km surface soil moisture extraction with transparent product recording
 * - Full observation record assembly with provenance and metadata
 */
const config = require('../../config');

class PreprocessingService {
  /**
   * Filters HLS observations for clouds/shadows and executes the 30d -> 60d fallback logic.
   * Spec Section 8 & 9.
   * 
   * @param {Array<Object>} observations - Array of raw daily HLS observations with { date, ndvi, evi, ndmi, qa, cloud_covered }
   * @param {string} anchorDateStr - ISO date string (YYYY-MM-DD)
   * @returns {Object} { windowUsed: 30 | 60 | null, validObservations: Array, qualityStatus: 'usable' | 'insufficient_observations' }
   */
  filterAndEvaluateHls(observations, anchorDateStr = config.DEMO_ANCHOR_DATE) {
    const anchor = new Date(anchorDateStr);
    const d30Start = new Date(anchor);
    d30Start.setDate(anchor.getDate() - 30);
    const d60Start = new Date(anchor);
    d60Start.setDate(anchor.getDate() - 60);

    const d30StartStr = d30Start.toISOString().split('T')[0];
    const d60StartStr = d60Start.toISOString().split('T')[0];
    const anchorStr = anchor.toISOString().split('T')[0];

    // Filter QA: Clear pixels only (no cloud, no cloud shadow, valid vegetation index)
    const validObs = observations.filter(obs => {
      if (obs.ndvi == null || isNaN(obs.ndvi)) return false;
      // QA bitmask check if QA is supplied:
      // Bit 1: Cloud, Bit 2: Cloud shadow, Bit 3: Adjacent cloud, Bit 4: Cirrus
      if (obs.qa != null) {
        const cloudBits = obs.qa & 0b00011110;
        if (cloudBits !== 0) return false;
      }
      if (obs.cloud_covered === true) return false;
      return true;
    });

    // Check 30-day primary window
    const obs30d = validObs.filter(obs => obs.date >= d30StartStr && obs.date <= anchorStr);
    if (obs30d.length >= config.MIN_VALID_OBS_HLS.PRIMARY_30D) {
      return {
        windowUsed: 30,
        startDate: d30StartStr,
        endDate: anchorStr,
        validObservations: obs30d,
        count: obs30d.length,
        qualityStatus: 'usable'
      };
    }

    // Fallback to 60-day window
    const obs60d = validObs.filter(obs => obs.date >= d60StartStr && obs.date <= anchorStr);
    if (obs60d.length >= config.MIN_VALID_OBS_HLS.FALLBACK_60D) {
      return {
        windowUsed: 60,
        startDate: d60StartStr,
        endDate: anchorStr,
        validObservations: obs60d,
        count: obs60d.length,
        qualityStatus: 'usable'
      };
    }

    // Insufficient observations in both windows
    return {
      windowUsed: null,
      startDate: d60StartStr,
      endDate: anchorStr,
      validObservations: obs60d,
      count: obs60d.length,
      qualityStatus: 'insufficient_observations'
    };
  }

  /**
   * Calculates rolling 30-day rainfall totals and consecutive dry days from a 90-day daily precipitation series.
   * Spec Section 8, 18, 19.
   * 
   * @param {Array<Object>} dailyRainfall - Array of { date, rainfall_mm } sorted chronologically
   * @param {string} analysisStartStr - Start date of analysis window (YYYY-MM-DD)
   * @param {string} analysisEndStr - End date of analysis window (YYYY-MM-DD)
   * @returns {Map<string, Object>} Map from date -> { rolling_30d_rainfall, dry_day_count, rainfall_mm }
   */
  calculateRollingRainfall(dailyRainfall, analysisStartStr, analysisEndStr) {
    // Sort chronologically ascending
    const sorted = [...dailyRainfall].sort((a, b) => a.date.localeCompare(b.date));
    const results = new Map();

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (current.date < analysisStartStr || current.date > analysisEndStr) {
        continue;
      }

      // 1. Calculate rolling 30-day cumulative rainfall: sum of prior 30 days [i-29, i]
      const windowStartIdx = Math.max(0, i - 29);
      const windowDays = sorted.slice(windowStartIdx, i + 1);
      
      let rollingSum = 0;
      for (const day of windowDays) {
        rollingSum += Number(day.rainfall_mm) || 0;
      }
      rollingSum = Math.round(rollingSum * 100) / 100;

      // 2. Calculate consecutive dry-day count (days with rainfall < 1.0 mm ending at date i)
      let dryCount = 0;
      for (let j = i; j >= 0; j--) {
        const val = Number(sorted[j].rainfall_mm) || 0;
        if (val < 1.0) {
          dryCount++;
        } else {
          break;
        }
      }

      results.set(current.date, {
        date: current.date,
        rainfall_mm: current.rainfall_mm != null ? Math.round(Number(current.rainfall_mm) * 100) / 100 : 0.0,
        rolling_30d_rainfall: rollingSum,
        dry_day_count: dryCount
      });
    }

    return results;
  }

  /**
   * Converts MODIS LST raw digital numbers to Celsius with QC validation.
   * Spec Section 3.4. Scale factor: 0.02, K = DN * 0.02, C = K - 273.15.
   * 
   * @param {number|null} rawLST - Raw integer DN from MOD11A1 / MYD11A1 LST_Day_1km
   * @param {number|null} rawQC - QC_Day byte
   * @returns {number|null} Temperature in Celsius rounded to 2 decimal places, or null if invalid
   */
  convertModisLst(rawLST, rawQC = 0) {
    if (rawLST == null || isNaN(rawLST) || rawLST === 0) {
      return null;
    }

    // Check mandatory QC bits (Bits 0-1):
    // 00: LST produced, good quality
    // 01: LST produced, other quality
    // 10 or 11: LST not produced (cloud or other reasons)
    if (rawQC != null) {
      const mandatoryQC = rawQC & 0b11;
      if (mandatoryQC > 1) {
        return null;
      }
    }

    const kelvin = rawLST * 0.02;
    if (kelvin < 200 || kelvin > 350) { // Physical terrestrial plausibility filter
      return null;
    }

    const celsius = kelvin - 273.15;
    return Math.round(celsius * 100) / 100;
  }

  /**
   * Extracts SMAP surface soil moisture with quality flag check.
   * Spec Section 3.2 & Section 4.
   * 
   * @param {number|null} rawMoisture - Soil_Moisture_AM in m3/m3
   * @param {number|null} qualityFlag - Quality_Flag_AM (0 = recommended quality)
   * @returns {number|null} Soil moisture in m3/m3 rounded to 4 decimal places, or null if invalid
   */
  extractSoilMoisture(rawMoisture, qualityFlag = 0) {
    if (rawMoisture == null || isNaN(rawMoisture) || rawMoisture < 0 || rawMoisture > 1) {
      return null;
    }
    // Quality flag: 0 indicates recommended retrieval quality
    if (qualityFlag != null && qualityFlag !== 0) {
      return null;
    }
    return Math.round(rawMoisture * 10000) / 10000;
  }

  /**
   * Assembles a standardized Earth Observation database record conforming strictly to Spec Section 43.
   */
  buildObservationRecord({
    field_id,
    observation_date,
    ndvi = null,
    evi = null,
    ndmi = null,
    ndmi_anomaly = null,
    soil_moisture = null,
    soil_moisture_anomaly = null,
    rainfall_mm = null,
    rolling_30d_rainfall = null,
    rainfall_anomaly = null,
    dry_day_count = null,
    daytime_lst_c = null,
    nighttime_lst_c = null,
    daytime_lst_anomaly = null,
    nighttime_lst_anomaly = null,
    hot_day_count = null,
    vegetation_stress = null,
    water_stress_index = null,
    adjusted_water_stress = null,
    heat_stress_index = null,
    quality_status = 'usable',
    hls_product = 'HLSL30_VI / HLSS30_VI',
    hls_version = '2.0',
    smap_product = 'SPL3SMP_E',
    smap_version = '006',
    gpm_product = 'GPM_3IMERGDF',
    gpm_version = '07',
    gpm_latency_class = 'Final',
    modis_product = 'MOD11A1.061 / MYD11A1.061',
    modis_version = '061',
    data_sources = {},
    analysis_window_start,
    analysis_window_end
  }) {
    return {
      field_id,
      observation_date,
      ndvi: ndvi != null ? Math.round(ndvi * 10000) / 10000 : null,
      evi: evi != null ? Math.round(evi * 10000) / 10000 : null,
      ndmi: ndmi != null ? Math.round(ndmi * 10000) / 10000 : null,
      ndmi_anomaly: ndmi_anomaly != null ? Math.round(ndmi_anomaly * 10000) / 10000 : null,
      soil_moisture: soil_moisture != null ? Math.round(soil_moisture * 10000) / 10000 : null,
      soil_moisture_anomaly: soil_moisture_anomaly != null ? Math.round(soil_moisture_anomaly * 10000) / 10000 : null,
      rainfall_mm: rainfall_mm != null ? Math.round(rainfall_mm * 100) / 100 : null,
      rolling_30d_rainfall: rolling_30d_rainfall != null ? Math.round(rolling_30d_rainfall * 100) / 100 : null,
      rainfall_anomaly: rainfall_anomaly != null ? Math.round(rainfall_anomaly * 100) / 100 : null,
      dry_day_count: dry_day_count != null ? Math.floor(dry_day_count) : null,
      daytime_lst_c: daytime_lst_c != null ? Math.round(daytime_lst_c * 100) / 100 : null,
      nighttime_lst_c: nighttime_lst_c != null ? Math.round(nighttime_lst_c * 100) / 100 : null,
      daytime_lst_anomaly: daytime_lst_anomaly != null ? Math.round(daytime_lst_anomaly * 100) / 100 : null,
      nighttime_lst_anomaly: nighttime_lst_anomaly != null ? Math.round(nighttime_lst_anomaly * 100) / 100 : null,
      hot_day_count: hot_day_count != null ? Math.floor(hot_day_count) : null,
      vegetation_stress: vegetation_stress != null ? Math.round(vegetation_stress * 10000) / 10000 : null,
      water_stress_index: water_stress_index != null ? Math.round(water_stress_index * 10000) / 10000 : null,
      adjusted_water_stress: adjusted_water_stress != null ? Math.round(adjusted_water_stress * 10000) / 10000 : null,
      heat_stress_index: heat_stress_index != null ? Math.round(heat_stress_index * 10000) / 10000 : null,
      quality_status,
      hls_product,
      hls_version,
      smap_product,
      smap_version,
      gpm_product,
      gpm_version,
      gpm_latency_class,
      modis_product,
      modis_version,
      processing_date: new Date().toISOString(),
      data_sources: data_sources || {},
      analysis_window_start,
      analysis_window_end
    };
  }
}

module.exports = new PreprocessingService();

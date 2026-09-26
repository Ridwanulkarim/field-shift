/**
 * Field Shift - Stress Calculation Engine (Phase 7)
 * Strictly implements:
 * - Spec Section 15: Standardized Stress (z-score, clamping to [0, 2], normalization to [0, 1], zero variance handling)
 * - Spec Section 16: Daily Stress Processing (daily clamp & normalize before averaging across current analysis window)
 * - Spec Section 17: Vegetation Stress (EVI stress; NDMI excluded to avoid double-counting)
 * - Spec Section 18: Water Stress Index (Soil Moisture 0.40 + Rainfall 0.30 + NDMI 0.30 with weight renormalization)
 * - Spec Section 19: Rainfall Stress (rolling 30d rainfall vs rolling 30d baseline)
 * - Spec Section 20: Irrigation Adjustment (0.7 factor for rotation scoring; raw environmental stress for Field Condition Score)
 * - Spec Section 21: Heat Stress Index (Daytime 0.60 + Nighttime 0.20 + Frequency 0.20 with weight renormalization)
 * - Spec Section 22: Hot-Day Frequency (daytime z >= 1.0 evaluated over CURRENT analysis window; (freq - 0.16)/(0.50 - 0.16))
 * - Spec Section 23: Field Condition Score (component_score = 100 * (1 - raw_stress); Veg 0.30 + Water 0.40 + Heat 0.30)
 * - Spec Section 24: NASA Data Quality Requirement (4/4 normal, 3/4 warning, <3 insufficient with null score)
 * - Spec Section 25: Field Condition Labels (Healthy relative condition, Watch closely, Moderate stress, High stress)
 * - Option A: Stored baselines table is the single source of truth for deterministic reproducibility (Section 48).
 */

class StressEngine {
  /**
   * Computes standardized z-score stress for a single numeric value (Spec Section 15).
   * 
   * @param {number|null} val - Current observed value
   * @param {number|null} mean - Stored baseline mean
   * @param {number|null} std - Stored baseline standard deviation
   * @param {boolean} lowerIsStress - true if lower-than-baseline indicates stress, false if higher
   * @returns {Object|null} { z, raw_stress, clamped_stress, normalized_stress, low_variance }
   */
  calculateStandardizedStress(val, mean, std, lowerIsStress = true) {
    if (val === null || val === undefined || isNaN(val)) return null;
    if (mean === null || mean === undefined || isNaN(mean)) return null;
    if (std === null || std === undefined || isNaN(std)) return null;

    const numericVal = Number(val);
    const numericMean = Number(mean);
    const numericStd = Number(std);

    // Spec Section 15: If baseline_std = 0: stress = 0, no division by zero, flag as low-variance.
    if (numericStd === 0) {
      return {
        z: 0.0,
        raw_stress: 0.0,
        clamped_stress: 0.0,
        normalized_stress: 0.0,
        low_variance: true
      };
    }

    const z = (numericVal - numericMean) / numericStd;
    const raw_stress = lowerIsStress ? -z : z;
    const clamped_stress = Math.max(0, Math.min(2, raw_stress));
    const normalized_stress = clamped_stress / 2.0;

    return {
      z: Math.round(z * 10000) / 10000,
      raw_stress: Math.round(raw_stress * 10000) / 10000,
      clamped_stress: Math.round(clamped_stress * 10000) / 10000,
      normalized_stress: Math.round(normalized_stress * 10000) / 10000,
      low_variance: false
    };
  }

  /**
   * Computes hot-day frequency over the CURRENT analysis window (Spec Section 22).
   * A hot day is a day with daytime LST z-score >= 1.0 against the stored seasonal baseline.
   * 
   * @param {Array<Object>} observations - Daily observations in the current analysis window
   * @param {number} daytimeMean - Stored baseline daytime LST mean
   * @param {number} daytimeStd - Stored baseline daytime LST std
   * @returns {Object} { hot_days, valid_days, hot_day_frequency, frequency_stress }
   */
  calculateHotDayFrequency(observations = [], daytimeMean, daytimeStd) {
    if (daytimeMean == null || daytimeStd == null) {
      return { hot_days: 0, valid_days: 0, hot_day_frequency: null, frequency_stress: null };
    }

    const validObs = observations.filter(o => o.daytime_lst_c != null && !isNaN(o.daytime_lst_c));
    const valid_days = validObs.length;

    if (valid_days === 0) {
      return { hot_days: 0, valid_days: 0, hot_day_frequency: null, frequency_stress: null };
    }

    const mean = Number(daytimeMean);
    const std = Number(daytimeStd);

    let hot_days = 0;
    for (const obs of validObs) {
      const val = Number(obs.daytime_lst_c);
      const z = std === 0 ? 0 : (val - mean) / std;
      if (z >= 1.0) {
        hot_days++;
      }
    }

    const hot_day_frequency = hot_days / valid_days;
    // Spec Section 22: clamp((hot_day_frequency - 0.16) / (0.50 - 0.16), 0, 1)
    const frequency_stress = Math.max(0, Math.min(1, (hot_day_frequency - 0.16) / (0.50 - 0.16)));

    return {
      hot_days,
      valid_days,
      hot_day_frequency: Math.round(hot_day_frequency * 10000) / 10000,
      frequency_stress: Math.round(frequency_stress * 10000) / 10000
    };
  }

  /**
   * Combines water stress components with weight renormalization (Spec Section 18).
   * Weights: Soil Moisture (0.40) + Rainfall (0.30) + NDMI (0.30).
   * 
   * @param {number|null} soilStress 
   * @param {number|null} rainStress 
   * @param {number|null} ndmiStress 
   * @returns {Object} { water_stress_index, available_components, missing_components, warning }
   */
  combineWaterStress(soilStress, rainStress, ndmiStress) {
    const components = [];
    if (soilStress != null && !isNaN(soilStress)) components.push({ name: 'soil_moisture', weight: 0.40, value: Number(soilStress) });
    if (rainStress != null && !isNaN(rainStress)) components.push({ name: 'rainfall', weight: 0.30, value: Number(rainStress) });
    if (ndmiStress != null && !isNaN(ndmiStress)) components.push({ name: 'ndmi', weight: 0.30, value: Number(ndmiStress) });

    const allKeys = ['soil_moisture', 'rainfall', 'ndmi'];
    const available_components = components.map(c => c.name);
    const missing_components = allKeys.filter(k => !available_components.includes(k));

    if (components.length === 0) {
      return {
        water_stress_index: null,
        available_components: [],
        missing_components: allKeys,
        warning: 'Water stress could not be calculated from available NASA observations.'
      };
    }

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = components.reduce((sum, c) => sum + (c.value * c.weight), 0);
    const water_stress_index = weightedSum / totalWeight;

    return {
      water_stress_index: Math.round(water_stress_index * 10000) / 10000,
      available_components,
      missing_components,
      warning: missing_components.length > 0 ? `Missing water inputs: ${missing_components.join(', ')}` : null
    };
  }

  /**
   * Applies irrigation adjustment factor to water stress for rotation scoring (Spec Section 20).
   * Irrigation factor: 0.7 if irrigation_available, else 1.0.
   */
  calculateAdjustedWaterStress(waterStressIndex, irrigationAvailable = false) {
    if (waterStressIndex == null || isNaN(waterStressIndex)) return null;
    const factor = irrigationAvailable ? 0.7 : 1.0;
    const adjusted = Math.max(0, Math.min(1, Number(waterStressIndex) * factor));
    return Math.round(adjusted * 10000) / 10000;
  }

  /**
   * Combines heat stress components with weight renormalization (Spec Section 21).
   * Weights: Daytime LST (0.60) + Nighttime LST (0.20) + Hot-Day Frequency (0.20).
   * 
   * @param {number|null} daytimeStress 
   * @param {number|null} nighttimeStress 
   * @param {number|null} frequencyStress 
   * @returns {Object} { heat_stress_index, available_components, missing_components, warning }
   */
  combineHeatStress(daytimeStress, nighttimeStress, frequencyStress) {
    const components = [];
    if (daytimeStress != null && !isNaN(daytimeStress)) components.push({ name: 'daytime_lst', weight: 0.60, value: Number(daytimeStress) });
    if (nighttimeStress != null && !isNaN(nighttimeStress)) components.push({ name: 'nighttime_lst', weight: 0.20, value: Number(nighttimeStress) });
    if (frequencyStress != null && !isNaN(frequencyStress)) components.push({ name: 'hot_day_frequency', weight: 0.20, value: Number(frequencyStress) });

    const allKeys = ['daytime_lst', 'nighttime_lst', 'hot_day_frequency'];
    const available_components = components.map(c => c.name);
    const missing_components = allKeys.filter(k => !available_components.includes(k));

    if (components.length === 0) {
      return {
        heat_stress_index: null,
        available_components: [],
        missing_components: allKeys,
        warning: 'Heat stress could not be calculated from available NASA observations.'
      };
    }

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = components.reduce((sum, c) => sum + (c.value * c.weight), 0);
    const heat_stress_index = weightedSum / totalWeight;

    return {
      heat_stress_index: Math.round(heat_stress_index * 10000) / 10000,
      available_components,
      missing_components,
      warning: missing_components.length > 0 ? `Missing heat inputs: ${missing_components.join(', ')}` : null
    };
  }

  /**
   * Computes Field Condition Score from raw environmental stresses (Spec Section 23, 24, 25).
   * Strictly uses raw unadjusted water stress (never irrigation-adjusted stress).
   * 
   * @param {number|null} vegetationStress 
   * @param {number|null} waterStressIndex - Raw unadjusted water stress
   * @param {number|null} heatStressIndex 
   * @param {number} nasaSourcesAvailable - Count of available NASA dataset families (0 to 4)
   * @returns {Object}
   */
  calculateFieldConditionScore(vegetationStress, waterStressIndex, heatStressIndex, nasaSourcesAvailable = 4) {
    // Spec Section 24: Data quality status
    let data_quality_status = 'normal';
    if (nasaSourcesAvailable === 3) {
      data_quality_status = 'warning';
    } else if (nasaSourcesAvailable < 3) {
      data_quality_status = 'insufficient_observations';
    }

    // Component condition scores: component_score = 100 * (1 - stress)
    const vegScore = vegetationStress != null ? Math.round(100 * (1 - Number(vegetationStress)) * 100) / 100 : null;
    const waterScore = waterStressIndex != null ? Math.round(100 * (1 - Number(waterStressIndex)) * 100) / 100 : null;
    const heatScore = heatStressIndex != null ? Math.round(100 * (1 - Number(heatStressIndex)) * 100) / 100 : null;

    const components = [];
    if (vegScore != null) components.push({ name: 'vegetation', weight: 0.30, value: vegScore });
    if (waterScore != null) components.push({ name: 'water', weight: 0.40, value: waterScore });
    if (heatScore != null) components.push({ name: 'heat', weight: 0.30, value: heatScore });

    const allComponents = ['vegetation', 'water', 'heat'];
    const available_components = components.map(c => c.name);
    const missing_components = allComponents.filter(k => !available_components.includes(k));

    // Spec Section 24: If fewer than 3 NASA sources, score is null
    if (nasaSourcesAvailable < 3 || components.length === 0) {
      return {
        vegetation_condition_score: vegScore,
        water_condition_score: waterScore,
        heat_condition_score: heatScore,
        field_condition_score: null,
        label: null,
        available_components,
        missing_components,
        nasa_sources_available: nasaSourcesAvailable,
        data_quality_status,
        warning: 'Insufficient NASA observations for reliable field-condition analysis.'
      };
    }

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = components.reduce((sum, c) => sum + (c.value * c.weight), 0);
    const finalScore = Math.round((weightedSum / totalWeight) * 100) / 100;

    // Spec Section 25: Field Condition Labels
    let label = 'Moderate stress';
    if (finalScore >= 75) {
      label = 'Healthy relative condition';
    } else if (finalScore >= 50) {
      label = 'Watch closely';
    } else if (finalScore >= 25) {
      label = 'Moderate stress';
    } else {
      label = 'High stress';
    }

    return {
      vegetation_condition_score: vegScore,
      water_condition_score: waterScore,
      heat_condition_score: heatScore,
      field_condition_score: finalScore,
      label,
      available_components,
      missing_components,
      nasa_sources_available: nasaSourcesAvailable,
      data_quality_status,
      warning: data_quality_status === 'warning' ? 'Analysis continues with 3 of 4 NASA dataset families available.' : null
    };
  }

  /**
   * Evaluates daily stress processing and aggregates across the full analysis window.
   * Spec Section 16: Clamps and normalizes each daily stress first, then averages across the window.
   * 
   * @param {Object} field - Demo field record
   * @param {Array<Object>} storedBaselines - Baselines loaded from the 'baselines' table (Option A)
   * @param {Array<Object>} observations - Daily observations in the current analysis window
   * @returns {Object} Comprehensive stress and field condition results
   */
  processFieldStressAndCondition(field, storedBaselines = [], observations = []) {
    // 1. Build lookup map of stored baselines by variable
    const baselineMap = {};
    const baselineIdsUsed = [];
    for (const b of storedBaselines) {
      baselineMap[b.variable] = b;
      if (b.id) baselineIdsUsed.push(b.id);
    }

    const processedDailyObs = [];
    let runningHotDays = 0;

    // Track daily normalized stresses for window averaging
    const dailyEviStresses = [];
    const dailySoilStresses = [];
    const dailyRainStresses = [];
    const dailyNdmiStresses = [];
    const dailyDaytimeStresses = [];
    const dailyNighttimeStresses = [];

    // 2. Iterate each day in the current analysis window
    for (const obs of observations) {
      // Vegetation: EVI & NDMI
      const eviBase = baselineMap['evi'];
      const ndmiBase = baselineMap['ndmi'];
      const soilBase = baselineMap['soil_moisture'];
      const rainBase = baselineMap['rolling_30d_rainfall'];
      const dayBase = baselineMap['daytime_lst_c'];
      const nightBase = baselineMap['nighttime_lst_c'];

      // Anomalies (current - baseline_mean)
      const ndmi_anomaly = (obs.ndmi != null && ndmiBase) ? Math.round((Number(obs.ndmi) - Number(ndmiBase.mean)) * 10000) / 10000 : null;
      const soil_moisture_anomaly = (obs.soil_moisture != null && soilBase) ? Math.round((Number(obs.soil_moisture) - Number(soilBase.mean)) * 10000) / 10000 : null;
      const rainfall_anomaly = (obs.rolling_30d_rainfall != null && rainBase) ? Math.round((Number(obs.rolling_30d_rainfall) - Number(rainBase.mean)) * 100) / 100 : null;
      const daytime_lst_anomaly = (obs.daytime_lst_c != null && dayBase) ? Math.round((Number(obs.daytime_lst_c) - Number(dayBase.mean)) * 100) / 100 : null;
      const nighttime_lst_anomaly = (obs.nighttime_lst_c != null && nightBase) ? Math.round((Number(obs.nighttime_lst_c) - Number(nightBase.mean)) * 100) / 100 : null;

      // Standardized Stress (clamped and normalized per day)
      const eviSt = eviBase ? this.calculateStandardizedStress(obs.evi, eviBase.mean, eviBase.std, true) : null;
      const ndmiSt = ndmiBase ? this.calculateStandardizedStress(obs.ndmi, ndmiBase.mean, ndmiBase.std, true) : null;
      const soilSt = soilBase ? this.calculateStandardizedStress(obs.soil_moisture, soilBase.mean, soilBase.std, true) : null;
      const rainSt = rainBase ? this.calculateStandardizedStress(obs.rolling_30d_rainfall, rainBase.mean, rainBase.std, true) : null;
      const daySt = dayBase ? this.calculateStandardizedStress(obs.daytime_lst_c, dayBase.mean, dayBase.std, false) : null;
      const nightSt = nightBase ? this.calculateStandardizedStress(obs.nighttime_lst_c, nightBase.mean, nightBase.std, false) : null;

      if (eviSt) dailyEviStresses.push(eviSt.normalized_stress);
      if (soilSt) dailySoilStresses.push(soilSt.normalized_stress);
      if (rainSt) dailyRainStresses.push(rainSt.normalized_stress);
      if (ndmiSt) dailyNdmiStresses.push(ndmiSt.normalized_stress);
      if (daySt) dailyDaytimeStresses.push(daySt.normalized_stress);
      if (nightSt) dailyNighttimeStresses.push(nightSt.normalized_stress);

      // Hot-day check (daytime z >= 1.0)
      const isHotDay = daySt ? (daySt.z >= 1.0) : false;
      if (isHotDay) runningHotDays++;

      // Daily vegetation stress (Spec Section 17: strictly EVI stress, NDMI excluded)
      const daily_veg_stress = eviSt ? eviSt.normalized_stress : null;

      // Daily water stress
      const dailyWater = this.combineWaterStress(
        soilSt ? soilSt.normalized_stress : null,
        rainSt ? rainSt.normalized_stress : null,
        ndmiSt ? ndmiSt.normalized_stress : null
      );
      const daily_water_stress = dailyWater.water_stress_index;
      const daily_adjusted_water_stress = this.calculateAdjustedWaterStress(daily_water_stress, field.irrigation_available);

      // Daily heat stress (daytime + nighttime)
      let daily_heat_stress = null;
      if (daySt && nightSt) {
        daily_heat_stress = Math.round((daySt.normalized_stress * 0.75 + nightSt.normalized_stress * 0.25) * 10000) / 10000;
      } else if (daySt) {
        daily_heat_stress = daySt.normalized_stress;
      }

      processedDailyObs.push({
        id: obs.id,
        field_id: field.id,
        observation_date: obs.observation_date,
        ndvi: obs.ndvi,
        evi: obs.evi,
        ndmi: obs.ndmi,
        ndmi_anomaly,
        soil_moisture: obs.soil_moisture,
        soil_moisture_anomaly,
        rainfall_mm: obs.rainfall_mm,
        rolling_30d_rainfall: obs.rolling_30d_rainfall,
        rainfall_anomaly,
        dry_day_count: obs.dry_day_count,
        daytime_lst_c: obs.daytime_lst_c,
        nighttime_lst_c: obs.nighttime_lst_c,
        daytime_lst_anomaly,
        nighttime_lst_anomaly,
        hot_day_count: runningHotDays,
        vegetation_stress: daily_veg_stress,
        water_stress_index: daily_water_stress,
        adjusted_water_stress: daily_adjusted_water_stress,
        heat_stress_index: daily_heat_stress,
        quality_status: obs.quality_status || 'usable'
      });
    }

    // 3. Window-Level Averaging (Spec Section 16)
    const avg = arr => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    const window_vegetation_stress = avg(dailyEviStresses) != null ? Math.round(avg(dailyEviStresses) * 10000) / 10000 : null;
    const window_soil_stress = avg(dailySoilStresses) != null ? Math.round(avg(dailySoilStresses) * 10000) / 10000 : null;
    const window_rain_stress = avg(dailyRainStresses) != null ? Math.round(avg(dailyRainStresses) * 10000) / 10000 : null;
    const window_ndmi_stress = avg(dailyNdmiStresses) != null ? Math.round(avg(dailyNdmiStresses) * 10000) / 10000 : null;
    const window_daytime_stress = avg(dailyDaytimeStresses) != null ? Math.round(avg(dailyDaytimeStresses) * 10000) / 10000 : null;
    const window_nighttime_stress = avg(dailyNighttimeStresses) != null ? Math.round(avg(dailyNighttimeStresses) * 10000) / 10000 : null;

    // 4. Hot-Day Frequency over CURRENT analysis window (Spec Section 22)
    const dayBase = baselineMap['daytime_lst_c'];
    const hotDayResult = this.calculateHotDayFrequency(
      observations,
      dayBase ? dayBase.mean : null,
      dayBase ? dayBase.std : null
    );

    // 5. Final Window Water Stress & Heat Stress
    const windowWaterResult = this.combineWaterStress(window_soil_stress, window_rain_stress, window_ndmi_stress);
    const window_water_stress_index = windowWaterResult.water_stress_index;
    const window_adjusted_water_stress = this.calculateAdjustedWaterStress(window_water_stress_index, field.irrigation_available);

    const windowHeatResult = this.combineHeatStress(window_daytime_stress, window_nighttime_stress, hotDayResult.frequency_stress);
    const window_heat_stress_index = windowHeatResult.heat_stress_index;

    // 6. NASA Dataset Families Availability (Spec Section 24)
    // Check 4 families: 1. HLS (vegetation), 2. SMAP (soil), 3. GPM (rainfall), 4. MODIS (LST)
    const hlsAvailable = dailyEviStresses.length >= 3; // Section 9 definition
    const smapAvailable = dailySoilStresses.length > 0;
    const gpmAvailable = dailyRainStresses.length > 0;
    const modisAvailable = dailyDaytimeStresses.length > 0;

    let nasaSourcesAvailable = 0;
    if (hlsAvailable) nasaSourcesAvailable++;
    if (smapAvailable) nasaSourcesAvailable++;
    if (gpmAvailable) nasaSourcesAvailable++;
    if (modisAvailable) nasaSourcesAvailable++;

    // 7. Field Condition Score (Spec Section 23)
    const conditionResult = this.calculateFieldConditionScore(
      window_vegetation_stress,
      window_water_stress_index, // RAW environmental stress
      window_heat_stress_index,
      nasaSourcesAvailable
    );

    const formatIsoDate = d => {
      if (!d) return null;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return String(d).split('T')[0];
    };
    const dates = observations.map(o => formatIsoDate(o.observation_date)).filter(Boolean).sort();
    const window_start = dates.length > 0 ? dates[0] : '2023-12-30';
    const window_end = dates.length > 0 ? dates[dates.length - 1] : '2024-02-28';

    return {
      field_id: field.id,
      field_name: field.name,
      window_start,
      window_end,
      baseline_ids_used: baselineIdsUsed,
      observation_ids_used: observations.map(o => o.id).filter(Boolean),
      // Window Stresses
      vegetation_stress: window_vegetation_stress,
      soil_moisture_stress: window_soil_stress,
      rainfall_stress: window_rain_stress,
      ndmi_stress: window_ndmi_stress,
      water_stress_index: window_water_stress_index,
      adjusted_water_stress: window_adjusted_water_stress,
      daytime_lst_stress: window_daytime_stress,
      nighttime_lst_stress: window_nighttime_stress,
      hot_days: hotDayResult.hot_days,
      valid_days: hotDayResult.valid_days,
      hot_day_frequency: hotDayResult.hot_day_frequency,
      hot_day_frequency_stress: hotDayResult.frequency_stress,
      heat_stress_index: window_heat_stress_index,
      // Field Condition Score Record
      field_condition_score_record: {
        field_id: field.id,
        window_start,
        window_end,
        vegetation_condition_score: conditionResult.vegetation_condition_score,
        water_condition_score: conditionResult.water_condition_score,
        heat_condition_score: conditionResult.heat_condition_score,
        field_condition_score: conditionResult.field_condition_score,
        available_components: conditionResult.available_components,
        missing_components: conditionResult.missing_components,
        nasa_sources_available: conditionResult.nasa_sources_available,
        data_quality_status: conditionResult.data_quality_status,
        scoring_version: 'v6.2'
      },
      label: conditionResult.label,
      data_quality_status: conditionResult.data_quality_status,
      // Processed Daily Observations ready for update
      processed_daily_observations: processedDailyObs
    };
  }
}

module.exports = new StressEngine();

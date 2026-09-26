/**
 * Field Shift - Historical NASA Observations Service (Phase 6)
 * Generates multi-year historical observations (2019-2022) across the full Rabi analysis window
 * (with DOY +/- 7 day padding) for the 5 demo fields across HLS, SMAP, GPM, and MODIS.
 * Strictly adheres to Spec Section 10 (Current-Year Exclusion) and Section 12-14.
 */

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function pseudoRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

class HistoricalDataService {
  constructor() {
    this.HISTORICAL_RABI_YEARS = [2019, 2020, 2021, 2022]; // Excludes current year 2023
  }

  /**
   * Generates all historical observations across the full Rabi analysis window
   * (Dec 23 of year Y to March 6 of year Y+1) for each historical year Y.
   * 
   * @param {number} fieldId
   * @param {Array<Object>} fieldHistory - Array of { year, season, crop, crop_family }
   * @returns {Array<Object>}
   */
  getAllHistoricalObservations(fieldId, fieldHistory = []) {
    const records = [];

    const rabiHistoryMap = new Map();
    for (const h of fieldHistory) {
      if (h.season === 'Rabi') {
        rabiHistoryMap.set(Number(h.year), h);
      }
    }

    for (const startYear of this.HISTORICAL_RABI_YEARS) {
      const rabiCrop = rabiHistoryMap.get(startYear) || { crop: 'Unknown', crop_family: 'Unknown' };

      // Full window with margin: Dec 23 of startYear to March 6 of startYear+1 (74 calendar days)
      const startDate = new Date(Date.UTC(startYear, 11, 23)); // Dec 23
      const endDate = new Date(Date.UTC(startYear + 1, 2, 6));   // March 6

      let curr = new Date(startDate);
      let dayIndex = 0;

      while (curr <= endDate) {
        const dateStr = curr.toISOString().split('T')[0];
        const doy = getDayOfYear(curr);

        let seed = fieldId * 5000 + startYear * 100 + doy;

        // 1. GPM 30-day rolling rainfall (historical late-winter totals: 5mm to 35mm in Bangladesh)
        let histRainfall30d = 12.0;
        if (fieldId === 1) histRainfall30d = 8.5 + pseudoRandom(seed) * 10.0;
        if (fieldId === 2) histRainfall30d = 14.0 + pseudoRandom(seed) * 12.0;
        if (fieldId === 3) histRainfall30d = 18.0 + pseudoRandom(seed) * 14.0;
        if (fieldId === 4) histRainfall30d = 11.0 + pseudoRandom(seed) * 11.0;
        if (fieldId === 5) histRainfall30d = 10.0 + pseudoRandom(seed) * 9.0;

        // 2. SMAP 9km soil moisture (0.18 to 0.38 m3/m3 in winter)
        let histSoilMoisture = 0.22;
        if (fieldId === 1) histSoilMoisture = 0.19 + pseudoRandom(seed + 1) * 0.04;
        if (fieldId === 2) histSoilMoisture = 0.25 + pseudoRandom(seed + 1) * 0.04;
        if (fieldId === 3) histSoilMoisture = 0.33 + pseudoRandom(seed + 1) * 0.05; // wet lowland basin
        if (fieldId === 4) histSoilMoisture = 0.22 + pseudoRandom(seed + 1) * 0.04;
        if (fieldId === 5) histSoilMoisture = 0.21 + pseudoRandom(seed + 1) * 0.04;

        // 3. MODIS LST (Daytime 24-30 C, Nighttime 12-16 C)
        let histDayLST = 26.0;
        let histNightLST = 14.0;
        if (fieldId === 1) { histDayLST = 27.2 + pseudoRandom(seed + 2) * 3.0; histNightLST = 13.8 + pseudoRandom(seed + 3) * 2.0; }
        if (fieldId === 2) { histDayLST = 24.8 + pseudoRandom(seed + 2) * 2.5; histNightLST = 12.2 + pseudoRandom(seed + 3) * 2.0; }
        if (fieldId === 3) { histDayLST = 25.5 + pseudoRandom(seed + 2) * 2.5; histNightLST = 14.1 + pseudoRandom(seed + 3) * 2.0; }
        if (fieldId === 4) { histDayLST = 27.8 + pseudoRandom(seed + 2) * 3.0; histNightLST = 15.2 + pseudoRandom(seed + 3) * 2.0; }
        if (fieldId === 5) { histDayLST = 29.1 + pseudoRandom(seed + 2) * 3.5; histNightLST = 16.4 + pseudoRandom(seed + 3) * 2.0; }

        // 4. HLS Vegetation Indices (Landsat 8-day + Sentinel 5-day overpasses: ~11 passes per 30 days)
        // Overpass schedule matches Phase 5: (dayIndex % 5 === 1 || dayIndex % 5 === 4 || dayIndex % 8 === 2)
        const isLandsatPass = (dayIndex % 8 === 2);
        const isSentinelPass = (dayIndex % 5 === 1 || dayIndex % 5 === 4);
        const isOverpass = isLandsatPass || isSentinelPass;
        const isCloudCovered = isOverpass && (pseudoRandom(seed + 4) > 0.82);
        const hlsValid = isOverpass && !isCloudCovered;

        let histEvi = null;
        let histNdvi = null;
        let histNdmi = null;

        if (hlsValid) {
          if (rabiCrop.crop_family === 'Cereal') { // Wheat or Boro Rice
            histNdvi = 0.66 + pseudoRandom(seed + 5) * 0.08;
            histEvi = 0.42 + pseudoRandom(seed + 6) * 0.06;
            histNdmi = (fieldId === 3 ? 0.32 : 0.22) + pseudoRandom(seed + 7) * 0.05;
          } else if (rabiCrop.crop_family === 'Legume') { // Chickpea or Lentil
            histNdvi = 0.56 + pseudoRandom(seed + 5) * 0.07;
            histEvi = 0.34 + pseudoRandom(seed + 6) * 0.05;
            histNdmi = 0.14 + pseudoRandom(seed + 7) * 0.04;
          } else if (rabiCrop.crop_family === 'Oilseed') { // Mustard
            histNdvi = 0.54 + pseudoRandom(seed + 5) * 0.06;
            histEvi = 0.33 + pseudoRandom(seed + 6) * 0.05;
            histNdmi = 0.15 + pseudoRandom(seed + 7) * 0.04;
          } else { // Solanaceae or other
            histNdvi = 0.48 + pseudoRandom(seed + 5) * 0.06;
            histEvi = 0.29 + pseudoRandom(seed + 6) * 0.05;
            histNdmi = 0.12 + pseudoRandom(seed + 7) * 0.04;
          }
        }

        records.push({
          field_id: fieldId,
          year: startYear, // Rabi start year
          calendar_year: curr.getUTCFullYear(),
          date: dateStr,
          doy,
          crop: rabiCrop.crop,
          crop_family: rabiCrop.crop_family,
          evi: histEvi != null ? Math.round(histEvi * 10000) / 10000 : null,
          ndvi: histNdvi != null ? Math.round(histNdvi * 10000) / 10000 : null,
          ndmi: histNdmi != null ? Math.round(histNdmi * 10000) / 10000 : null,
          soil_moisture: Math.round(histSoilMoisture * 10000) / 10000,
          rolling_30d_rainfall: Math.round(histRainfall30d * 100) / 100,
          daytime_lst_c: Math.round(histDayLST * 100) / 100,
          nighttime_lst_c: Math.round(histNightLST * 100) / 100
        });

        curr.setUTCDate(curr.getUTCDate() + 1);
        dayIndex++;
      }
    }

    return records;
  }

  /**
   * Returns historical observations filtered to the current analysis window duration (e.g. 30 days for HLS, 61 days for daily variables).
   */
  getHistoricalObservationsForWindow(fieldId, windowDays = 60, anchorDateStr = '2024-02-28', fieldHistory = []) {
    const allObs = this.getAllHistoricalObservations(fieldId, fieldHistory);
    const anchor = new Date(anchorDateStr);
    
    // For each historical year, extract the window ending on Feb 28 of year Y+1
    const filtered = allObs.filter(obs => {
      const obsDate = new Date(obs.date);
      const feb28 = new Date(Date.UTC(obs.year + 1, 1, 28));
      const windowStart = new Date(feb28);
      windowStart.setUTCDate(feb28.getUTCDate() - (windowDays - 1));

      return obsDate >= windowStart && obsDate <= feb28;
    });

    return filtered;
  }

  /**
   * Returns historical observations matching DOY +/- marginDays for a specific target observation date.
   * Spec Section 12 (used for daily stress processing in Section 16).
   */
  getHistoricalObservationsForDOY(fieldId, targetDateStr, fieldHistory = [], marginDays = 7) {
    const allObs = this.getAllHistoricalObservations(fieldId, fieldHistory);
    const targetDate = new Date(targetDateStr);
    const targetDOY = getDayOfYear(targetDate);

    return allObs.filter(obs => {
      // Handle day-of-year distance with circular calendar wrapping
      const diff = Math.abs(obs.doy - targetDOY);
      const circularDiff = Math.min(diff, 365 - diff);
      return circularDiff <= marginDays;
    });
  }
}

module.exports = new HistoricalDataService();

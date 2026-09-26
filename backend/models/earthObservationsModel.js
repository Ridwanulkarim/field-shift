/**
 * Field Shift - Earth Observations Model (Spec Section 43)
 * Unique per (field_id, observation_date) with upsert support.
 */
const db = require('../db');

const EarthObservationsModel = {
  async upsert(data) {
    const query = `
      INSERT INTO earth_observations (
        field_id, observation_date,
        ndvi, evi, ndmi, ndmi_anomaly,
        soil_moisture, soil_moisture_anomaly,
        rainfall_mm, rolling_30d_rainfall, rainfall_anomaly, dry_day_count,
        daytime_lst_c, nighttime_lst_c, daytime_lst_anomaly, nighttime_lst_anomaly,
        hot_day_count,
        vegetation_stress, water_stress_index, adjusted_water_stress, heat_stress_index,
        quality_status,
        hls_product, hls_version,
        smap_product, smap_version,
        gpm_product, gpm_version, gpm_latency_class,
        modis_product, modis_version,
        processing_date, data_sources,
        analysis_window_start, analysis_window_end
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35
      )
      ON CONFLICT (field_id, observation_date) DO UPDATE SET
        ndvi = EXCLUDED.ndvi,
        evi = EXCLUDED.evi,
        ndmi = EXCLUDED.ndmi,
        ndmi_anomaly = EXCLUDED.ndmi_anomaly,
        soil_moisture = EXCLUDED.soil_moisture,
        soil_moisture_anomaly = EXCLUDED.soil_moisture_anomaly,
        rainfall_mm = EXCLUDED.rainfall_mm,
        rolling_30d_rainfall = EXCLUDED.rolling_30d_rainfall,
        rainfall_anomaly = EXCLUDED.rainfall_anomaly,
        dry_day_count = EXCLUDED.dry_day_count,
        daytime_lst_c = EXCLUDED.daytime_lst_c,
        nighttime_lst_c = EXCLUDED.nighttime_lst_c,
        daytime_lst_anomaly = EXCLUDED.daytime_lst_anomaly,
        nighttime_lst_anomaly = EXCLUDED.nighttime_lst_anomaly,
        hot_day_count = EXCLUDED.hot_day_count,
        vegetation_stress = EXCLUDED.vegetation_stress,
        water_stress_index = EXCLUDED.water_stress_index,
        adjusted_water_stress = EXCLUDED.adjusted_water_stress,
        heat_stress_index = EXCLUDED.heat_stress_index,
        quality_status = EXCLUDED.quality_status,
        hls_product = EXCLUDED.hls_product,
        hls_version = EXCLUDED.hls_version,
        smap_product = EXCLUDED.smap_product,
        smap_version = EXCLUDED.smap_version,
        gpm_product = EXCLUDED.gpm_product,
        gpm_version = EXCLUDED.gpm_version,
        gpm_latency_class = EXCLUDED.gpm_latency_class,
        modis_product = EXCLUDED.modis_product,
        modis_version = EXCLUDED.modis_version,
        processing_date = EXCLUDED.processing_date,
        data_sources = EXCLUDED.data_sources,
        analysis_window_start = EXCLUDED.analysis_window_start,
        analysis_window_end = EXCLUDED.analysis_window_end
      RETURNING *;
    `;

    const values = [
      data.field_id,
      data.observation_date,
      data.ndvi ?? null,
      data.evi ?? null,
      data.ndmi ?? null,
      data.ndmi_anomaly ?? null,
      data.soil_moisture ?? null,
      data.soil_moisture_anomaly ?? null,
      data.rainfall_mm ?? null,
      data.rolling_30d_rainfall ?? null,
      data.rainfall_anomaly ?? null,
      data.dry_day_count ?? null,
      data.daytime_lst_c ?? null,
      data.nighttime_lst_c ?? null,
      data.daytime_lst_anomaly ?? null,
      data.nighttime_lst_anomaly ?? null,
      data.hot_day_count ?? null,
      data.vegetation_stress ?? null,
      data.water_stress_index ?? null,
      data.adjusted_water_stress ?? null,
      data.heat_stress_index ?? null,
      data.quality_status ?? null,
      data.hls_product ?? null,
      data.hls_version ?? null,
      data.smap_product ?? null,
      data.smap_version ?? null,
      data.gpm_product ?? null,
      data.gpm_version ?? null,
      data.gpm_latency_class ?? null,
      data.modis_product ?? null,
      data.modis_version ?? null,
      data.processing_date || new Date(),
      data.data_sources ? (typeof data.data_sources === 'object' ? JSON.stringify(data.data_sources) : data.data_sources) : null,
      data.analysis_window_start ?? null,
      data.analysis_window_end ?? null
    ];

    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findByField(fieldId, startDate = null, endDate = null) {
    if (startDate && endDate) {
      const res = await db.query(
        `SELECT * FROM earth_observations 
         WHERE field_id = $1 AND observation_date BETWEEN $2 AND $3
         ORDER BY observation_date ASC;`,
        [fieldId, startDate, endDate]
      );
      return res.rows;
    }
    const res = await db.query(
      `SELECT * FROM earth_observations 
       WHERE field_id = $1 
       ORDER BY observation_date ASC;`,
      [fieldId]
    );
    return res.rows;
  },

  async findLatestByField(fieldId) {
    const res = await db.query(
      `SELECT * FROM earth_observations 
       WHERE field_id = $1 
       ORDER BY observation_date DESC 
       LIMIT 1;`,
      [fieldId]
    );
    return res.rows[0] || null;
  },

  async deleteByField(fieldId) {
    const res = await db.query(
      'DELETE FROM earth_observations WHERE field_id = $1 RETURNING id;',
      [fieldId]
    );
    return res.rows;
  }
};

module.exports = EarthObservationsModel;

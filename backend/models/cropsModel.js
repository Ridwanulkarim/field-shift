/**
 * Field Shift - Crops Model (Spec Section 43, 26, 27)
 * Implements per-trait source status and agronomic compatibility parameters.
 */
const db = require('../db');

const CropsModel = {
  async create(data) {
    const query = `
      INSERT INTO crops (
        name, crop_family,
        water_demand, heat_tolerance, soil_health_benefit, diversity_value, profitability_value,
        water_demand_status, heat_tolerance_status, soil_health_benefit_status,
        diversity_value_status, profitability_value_status,
        growing_days, suitable_seasons, waterlogging_tolerance,
        min_soil_ph, max_soil_ph,
        source_name, source_url, source_reference, source_notes,
        trait_mapping_method, trait_mapping_version, source_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )
      ON CONFLICT (name) DO UPDATE SET
        crop_family = EXCLUDED.crop_family,
        water_demand = EXCLUDED.water_demand,
        heat_tolerance = EXCLUDED.heat_tolerance,
        soil_health_benefit = EXCLUDED.soil_health_benefit,
        diversity_value = EXCLUDED.diversity_value,
        profitability_value = EXCLUDED.profitability_value,
        water_demand_status = EXCLUDED.water_demand_status,
        heat_tolerance_status = EXCLUDED.heat_tolerance_status,
        soil_health_benefit_status = EXCLUDED.soil_health_benefit_status,
        diversity_value_status = EXCLUDED.diversity_value_status,
        profitability_value_status = EXCLUDED.profitability_value_status,
        growing_days = EXCLUDED.growing_days,
        suitable_seasons = EXCLUDED.suitable_seasons,
        waterlogging_tolerance = EXCLUDED.waterlogging_tolerance,
        min_soil_ph = EXCLUDED.min_soil_ph,
        max_soil_ph = EXCLUDED.max_soil_ph,
        source_name = EXCLUDED.source_name,
        source_url = EXCLUDED.source_url,
        source_reference = EXCLUDED.source_reference,
        source_notes = EXCLUDED.source_notes,
        trait_mapping_method = EXCLUDED.trait_mapping_method,
        trait_mapping_version = EXCLUDED.trait_mapping_version,
        source_status = EXCLUDED.source_status
      RETURNING *;
    `;

    const values = [
      data.name,
      data.crop_family,
      data.water_demand ?? null,
      data.heat_tolerance ?? null,
      data.soil_health_benefit ?? null,
      data.diversity_value ?? null,
      data.profitability_value ?? null,
      data.water_demand_status || 'unverified',
      data.heat_tolerance_status || 'unverified',
      data.soil_health_benefit_status || 'unverified',
      data.diversity_value_status || 'unverified',
      data.profitability_value_status || 'unverified',
      data.growing_days,
      JSON.stringify(data.suitable_seasons),
      data.waterlogging_tolerance ?? null, // Nullable per Section 33
      data.min_soil_ph ?? null,
      data.max_soil_ph ?? null,
      data.source_name || null,
      data.source_url || null,
      data.source_reference || null,
      data.source_notes || null,
      data.trait_mapping_method || 'Qualitative_Mapping_Low25_Med50_High75',
      data.trait_mapping_version || 'v6.2',
      data.source_status || 'unverified' // 'verified', 'prototype-mapped', 'unverified'
    ];

    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findById(id) {
    const res = await db.query('SELECT * FROM crops WHERE id = $1;', [id]);
    return res.rows[0] || null;
  },

  async findByName(name) {
    const res = await db.query('SELECT * FROM crops WHERE LOWER(name) = LOWER($1);', [name]);
    return res.rows[0] || null;
  },

  async findAll() {
    const res = await db.query('SELECT * FROM crops ORDER BY name ASC;');
    return res.rows;
  },

  async delete(id) {
    const res = await db.query('DELETE FROM crops WHERE id = $1 RETURNING id;', [id]);
    return res.rows[0] || null;
  }
};

module.exports = CropsModel;

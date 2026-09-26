/**
 * Field Shift - Rotations Model
 * Manages database persistence and queries for the 'rotations' table (Spec Section 43).
 */
const db = require('../db');

class RotationsModel {
  static async create(data) {
    const query = `
      INSERT INTO rotations (
        field_id, name, season_sequence, crops, rotation_cycle_mode,
        repeat_context_crop, repeat_context_type,
        water_score, soil_score, heat_score, diversity_score, profitability_score,
        base_soil_health_score, drainage_penalty, ph_penalty, organic_matter_adjustment,
        soil_score_final, water_stress_index, adjusted_water_stress, heat_stress_index,
        water_multiplier, heat_multiplier, effective_water_weight, effective_heat_weight,
        overall_score, feasibility_status, sample_quality, crop_matched, data_quality_status,
        observation_ids_used, baseline_ids_used, explanation, scoring_version, scored_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34
      )
      RETURNING *;
    `;

    const values = [
      data.field_id,
      data.name,
      JSON.stringify(data.season_sequence),
      JSON.stringify(data.crops),
      data.rotation_cycle_mode,
      data.repeat_context_crop,
      data.repeat_context_type,
      data.water_score,
      data.soil_score,
      data.heat_score,
      data.diversity_score,
      data.profitability_score,
      data.base_soil_health_score,
      data.drainage_penalty,
      data.ph_penalty,
      data.organic_matter_adjustment || 0,
      data.soil_score_final,
      data.water_stress_index,
      data.adjusted_water_stress,
      data.heat_stress_index,
      data.water_multiplier,
      data.heat_multiplier,
      data.effective_water_weight,
      data.effective_heat_weight,
      data.overall_score,
      data.feasibility_status,
      data.sample_quality || null,
      data.crop_matched !== undefined ? data.crop_matched : null,
      data.data_quality_status || 'normal',
      JSON.stringify(data.observation_ids_used || []),
      JSON.stringify(data.baseline_ids_used || []),
      JSON.stringify(data.explanation),
      data.scoring_version || 'v6.2',
      data.scored_at || new Date().toISOString()
    ];

    const res = await db.query(query, values);
    return res.rows[0];
  }

  static async findByField(fieldId) {
    return this.findByFieldId(fieldId);
  }

  static async findByFieldId(fieldId) {
    const query = `
      SELECT * FROM rotations
      WHERE field_id = $1
      ORDER BY overall_score DESC;
    `;
    const res = await db.query(query, [fieldId]);
    return res.rows;
  }

  static async findById(id) {
    const query = `
      SELECT * FROM rotations
      WHERE id = $1;
    `;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }
}

module.exports = RotationsModel;

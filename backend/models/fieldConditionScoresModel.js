/**
 * Field Shift - Field Condition Scores Model (Spec Section 43 & Section 23)
 * Stores unadjusted raw environmental condition scores.
 */
const db = require('../db');

const FieldConditionScoresModel = {
  async create(data) {
    const query = `
      INSERT INTO field_condition_scores (
        field_id, window_start, window_end,
        vegetation_condition_score, water_condition_score, heat_condition_score,
        field_condition_score, available_components, missing_components,
        nasa_sources_available, data_quality_status, scoring_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const values = [
      data.field_id,
      data.window_start,
      data.window_end,
      data.vegetation_condition_score ?? null,
      data.water_condition_score ?? null,
      data.heat_condition_score ?? null,
      data.field_condition_score ?? null,
      JSON.stringify(data.available_components || []),
      JSON.stringify(data.missing_components || []),
      data.nasa_sources_available, // 0 to 4
      data.data_quality_status,   // 'normal', 'warning', 'insufficient_observations'
      data.scoring_version || 'v6.2'
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findLatestByField(fieldId) {
    const res = await db.query(
      `SELECT * FROM field_condition_scores 
       WHERE field_id = $1 
       ORDER BY window_end DESC, created_at DESC 
       LIMIT 1;`,
      [fieldId]
    );
    return res.rows[0] || null;
  },

  async findByField(fieldId) {
    const res = await db.query(
      `SELECT * FROM field_condition_scores 
       WHERE field_id = $1 
       ORDER BY window_end DESC;`,
      [fieldId]
    );
    return res.rows;
  },

  async delete(id) {
    const res = await db.query('DELETE FROM field_condition_scores WHERE id = $1 RETURNING id;', [id]);
    return res.rows[0] || null;
  }
};

module.exports = FieldConditionScoresModel;

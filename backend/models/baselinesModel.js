/**
 * Field Shift - Baselines Model (Spec Section 43 & Section 14)
 * Enforces dual quality dimensions: sample_quality ('usable', 'limited')
 * and crop_matched (true, false, NULL strictly for non-vegetation).
 */
const db = require('../db');

const BaselinesModel = {
  async create(data) {
    const query = `
      INSERT INTO baselines (
        field_id, variable, season, mean, std, n, n_years, years_included,
        period_start, period_end, method, sample_quality, crop_matched, gpm_latency_class
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;

    // Ensure crop_matched is strictly null for non-vegetation variables (Section 14)
    const isVegetation = ['evi', 'ndvi', 'ndmi'].includes(data.variable.toLowerCase());
    const cropMatched = isVegetation ? (data.crop_matched ?? null) : null;

    const values = [
      data.field_id,
      data.variable,
      data.season,
      data.mean,
      data.std,
      data.n,
      data.n_years,
      JSON.stringify(data.years_included),
      data.period_start,
      data.period_end,
      data.method || 'DOY_plus_minus_7_days',
      data.sample_quality, // 'usable' if n >= 10 and n_years >= 3, else 'limited'
      cropMatched,
      data.gpm_latency_class || null
    ];

    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findByFieldAndVariable(fieldId, variable, season) {
    const res = await db.query(
      `SELECT * FROM baselines 
       WHERE field_id = $1 AND variable = $2 AND season = $3
       ORDER BY created_at DESC 
       LIMIT 1;`,
      [fieldId, variable, season]
    );
    return res.rows[0] || null;
  },

  async findByField(fieldId) {
    const res = await db.query(
      'SELECT * FROM baselines WHERE field_id = $1 ORDER BY variable ASC, season ASC;',
      [fieldId]
    );
    return res.rows;
  },

  async deleteByField(fieldId) {
    const res = await db.query('DELETE FROM baselines WHERE field_id = $1 RETURNING id;', [fieldId]);
    return res.rows;
  }
};

module.exports = BaselinesModel;

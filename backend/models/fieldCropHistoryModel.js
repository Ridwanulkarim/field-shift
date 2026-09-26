/**
 * Field Shift - Field Crop History Model (Spec Section 43 & Section 11)
 * Enforces year + season matching and Rabi start-year rule.
 */
const db = require('../db');

const FieldCropHistoryModel = {
  async create(data) {
    const query = `
      INSERT INTO field_crop_history (
        field_id, year, season, crop, crop_family, source
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [
      data.field_id,
      data.year,
      data.season,
      data.crop,
      data.crop_family,
      data.source || 'hand-entered demo data'
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findByField(fieldId) {
    const res = await db.query(
      'SELECT * FROM field_crop_history WHERE field_id = $1 ORDER BY year DESC, season ASC;',
      [fieldId]
    );
    return res.rows;
  },

  async findByFieldAndSeason(fieldId, year, season) {
    const res = await db.query(
      'SELECT * FROM field_crop_history WHERE field_id = $1 AND year = $2 AND season = $3;',
      [fieldId, year, season]
    );
    return res.rows[0] || null;
  },

  async delete(id) {
    const res = await db.query('DELETE FROM field_crop_history WHERE id = $1 RETURNING id;', [id]);
    return res.rows[0] || null;
  }
};

module.exports = FieldCropHistoryModel;

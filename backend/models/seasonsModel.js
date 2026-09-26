/**
 * Field Shift - Seasons Model (Spec Section 28 & Section 43)
 * Provides access to configurable Bangladesh seasonal planning calendars.
 */
const db = require('../db');

const SeasonsModel = {
  async findAll() {
    const res = await db.query('SELECT * FROM seasons ORDER BY start_month ASC;');
    return res.rows;
  },

  async findByName(name) {
    const res = await db.query('SELECT * FROM seasons WHERE LOWER(name) = LOWER($1);', [name]);
    return res.rows[0] || null;
  },

  async update(id, data) {
    const query = `
      UPDATE seasons SET
        start_month = COALESCE($2, start_month),
        start_day = COALESCE($3, start_day),
        end_month = COALESCE($4, end_month),
        end_day = COALESCE($5, end_day),
        approx_days = COALESCE($6, approx_days),
        source_reference = COALESCE($7, source_reference)
      WHERE id = $1
      RETURNING *;
    `;
    const values = [
      id,
      data.start_month,
      data.start_day,
      data.end_month,
      data.end_day,
      data.approx_days,
      data.source_reference
    ];
    const res = await db.query(query, values);
    return res.rows[0] || null;
  }
};

module.exports = SeasonsModel;

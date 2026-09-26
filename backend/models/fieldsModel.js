/**
 * Field Shift - Fields Model (Spec Section 43)
 */
const db = require('../db');

const FieldsModel = {
  async create(data) {
    const query = `
      INSERT INTO fields (
        name, latitude, longitude, boundary_geojson, area_hectares,
        soil_type, soil_ph, organic_matter_percent, drainage, irrigation_available,
        current_crop, current_crop_family, previous_crop, previous_crop_family,
        current_season, is_demo, data_label
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;
    const values = [
      data.name,
      data.latitude,
      data.longitude,
      data.boundary_geojson ? JSON.stringify(data.boundary_geojson) : null,
      data.area_hectares || null,
      data.soil_type || null,
      data.soil_ph || null,
      data.organic_matter_percent || null,
      data.drainage || null,
      data.irrigation_available ?? false,
      data.current_crop || null,
      data.current_crop_family || null,
      data.previous_crop || null,
      data.previous_crop_family || null,
      data.current_season || null,
      data.is_demo ?? false,
      data.data_label || null
    ];
    const res = await db.query(query, values);
    return res.rows[0];
  },

  async findById(id) {
    const res = await db.query('SELECT * FROM fields WHERE id = $1;', [id]);
    return res.rows[0] || null;
  },

  async findAll({ isDemo = null } = {}) {
    if (isDemo !== null) {
      const res = await db.query('SELECT * FROM fields WHERE is_demo = $1 ORDER BY id ASC;', [isDemo]);
      return res.rows;
    }
    const res = await db.query('SELECT * FROM fields ORDER BY id ASC;');
    return res.rows;
  },

  async update(id, data) {
    const fieldsToUpdate = [];
    const values = [id];
    let idx = 2;

    const allowed = [
      'name', 'latitude', 'longitude', 'boundary_geojson', 'area_hectares',
      'soil_type', 'soil_ph', 'organic_matter_percent', 'drainage', 'irrigation_available',
      'current_crop', 'current_crop_family', 'previous_crop', 'previous_crop_family',
      'current_season', 'is_demo', 'data_label'
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fieldsToUpdate.push(`${key} = $${idx}`);
        values.push(key === 'boundary_geojson' && data[key] ? JSON.stringify(data[key]) : data[key]);
        idx++;
      }
    }

    if (fieldsToUpdate.length === 0) return this.findById(id);

    const query = `
      UPDATE fields
      SET ${fieldsToUpdate.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    const res = await db.query(query, values);
    return res.rows[0] || null;
  },

  async delete(id) {
    const res = await db.query('DELETE FROM fields WHERE id = $1 RETURNING id;', [id]);
    return res.rows[0] || null;
  }
};

module.exports = FieldsModel;

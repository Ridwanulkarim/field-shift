/**
 * Field Shift - Fields Route (Spec Section 45, 23-25, 51)
 */
const express = require('express');
const router = express.Router();
const FieldsModel = require('../models/fieldsModel');
const FieldCropHistoryModel = require('../models/fieldCropHistoryModel');
const FieldConditionScoresModel = require('../models/fieldConditionScoresModel');
const EarthObservationsModel = require('../models/earthObservationsModel');

function getConditionLabel(score) {
  if (score === null || score === undefined || isNaN(score)) return 'Insufficient observations';
  const s = Number(score);
  if (s >= 75) return 'Healthy relative condition';
  if (s >= 50) return 'Watch closely';
  if (s >= 25) return 'Moderate stress';
  return 'High stress';
}

function formatDateOnly(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

router.get('/', async (req, res) => {
  try {
    const fields = await FieldsModel.findAll();
    
    // Attach latest condition scores & NASA observation metadata
    const enrichedFields = await Promise.all(fields.map(async (f) => {
      const condition = await FieldConditionScoresModel.findLatestByField(f.id);
      const latestObs = await EarthObservationsModel.findLatestByField(f.id);
      return {
        id: f.id,
        name: f.name,
        latitude: Number(f.latitude),
        longitude: Number(f.longitude),
        soil_type: f.soil_type,
        soil_ph: Number(f.soil_ph),
        drainage: f.drainage,
        organic_matter_percent: Number(f.organic_matter_percent),
        irrigation_available: f.irrigation_available,
        current_crop: f.current_crop,
        current_crop_family: f.current_crop_family,
        previous_crop: f.previous_crop,
        previous_crop_family: f.previous_crop_family,
        current_season: f.current_season,
        is_demo: f.is_demo,
        data_label: f.data_label,
        nasa_metadata: latestObs ? {
          smap_product: latestObs.smap_product,
          smap_version: latestObs.smap_version,
          gpm_product: latestObs.gpm_product,
          gpm_version: latestObs.gpm_version,
          gpm_latency_class: latestObs.gpm_latency_class,
          hls_product: latestObs.hls_product,
          hls_version: latestObs.hls_version,
          modis_product: latestObs.modis_product,
          modis_version: latestObs.modis_version
        } : null,
        condition_score: condition ? {
          score: Number(condition.field_condition_score),
          label: getConditionLabel(condition.field_condition_score),
          vegetation_score: Number(condition.vegetation_condition_score),
          water_score: Number(condition.water_condition_score),
          heat_score: Number(condition.heat_condition_score),
          data_quality_status: condition.data_quality_status,
          window_start: formatDateOnly(condition.window_start),
          window_end: formatDateOnly(condition.window_end)
        } : null
      };
    }));

    res.json({
      count: enrichedFields.length,
      fields: enrichedFields
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const fieldId = parseInt(req.params.id, 10);
    if (isNaN(fieldId)) {
      return res.status(400).json({ error: 'Invalid field ID format' });
    }

    const field = await FieldsModel.findById(fieldId);
    if (!field) {
      return res.status(404).json({ error: `Field with ID ${fieldId} not found` });
    }

    const history = await FieldCropHistoryModel.findByField(fieldId);
    const condition = await FieldConditionScoresModel.findLatestByField(fieldId);
    const latestObs = await EarthObservationsModel.findLatestByField(fieldId);

    res.json({
      field: {
        id: field.id,
        name: field.name,
        latitude: Number(field.latitude),
        longitude: Number(field.longitude),
        boundary_geojson: typeof field.boundary_geojson === 'string' ? JSON.parse(field.boundary_geojson) : field.boundary_geojson,
        area_hectares: field.area_hectares ? Number(field.area_hectares) : null,
        soil_type: field.soil_type,
        soil_ph: Number(field.soil_ph),
        drainage: field.drainage,
        organic_matter_percent: Number(field.organic_matter_percent),
        irrigation_available: field.irrigation_available,
        current_crop: field.current_crop,
        current_crop_family: field.current_crop_family,
        previous_crop: field.previous_crop,
        previous_crop_family: field.previous_crop_family,
        current_season: field.current_season,
        is_demo: field.is_demo,
        data_label: field.data_label,
        nasa_metadata: latestObs ? {
          smap_product: latestObs.smap_product,
          smap_version: latestObs.smap_version,
          gpm_product: latestObs.gpm_product,
          gpm_version: latestObs.gpm_version,
          gpm_latency_class: latestObs.gpm_latency_class,
          hls_product: latestObs.hls_product,
          hls_version: latestObs.hls_version,
          modis_product: latestObs.modis_product,
          modis_version: latestObs.modis_version
        } : null
      },
      crop_history: history.map(h => ({
        id: h.id,
        year: h.year,
        season: h.season,
        crop: h.crop,
        crop_family: h.crop_family,
        source: h.source
      })),
      latest_condition_score: condition ? {
        score: Number(condition.field_condition_score),
        label: getConditionLabel(condition.field_condition_score),
        vegetation_score: Number(condition.vegetation_condition_score),
        water_score: Number(condition.water_condition_score),
        heat_score: Number(condition.heat_condition_score),
        data_quality_status: condition.data_quality_status,
        window_start: formatDateOnly(condition.window_start),
        window_end: formatDateOnly(condition.window_end)
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

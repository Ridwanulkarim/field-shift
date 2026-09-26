/**
 * Field Shift - Rotations Route (Spec Section 45, 36–41, 48–50)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const FieldsModel = require('../models/fieldsModel');
const CropsModel = require('../models/cropsModel');
const RotationsModel = require('../models/rotationsModel');
const ScoringEngine = require('../services/rotations/scoringEngine');

/**
 * POST /api/rotations/evaluate
 * Evaluate and persist a candidate crop rotation.
 */
router.post('/evaluate', async (req, res) => {
  try {
    const field_id = req.body.field_id;
    const name = req.body.name;
    const season_sequence = req.body.season_sequence || req.body.seasons;
    const crop_ids = req.body.crop_ids;
    const rotation_cycle_mode = req.body.rotation_cycle_mode || req.body.cycle_mode || 'continue_after_current';
    const priorities = req.body.priorities || req.body.weights || {};

    if (!field_id) {
      return res.status(400).json({ error: 'Missing required field: field_id' });
    }
    if (!Array.isArray(season_sequence) || season_sequence.length === 0) {
      return res.status(400).json({ error: 'season_sequence must be a non-empty array of seasons' });
    }
    if (!Array.isArray(crop_ids) || crop_ids.length === 0) {
      return res.status(400).json({ error: 'crop_ids must be a non-empty array of crop IDs' });
    }
    if (season_sequence.length !== crop_ids.length) {
      return res.status(400).json({ error: 'season_sequence and crop_ids arrays must have the same length' });
    }

    const field = await FieldsModel.findById(field_id);
    if (!field) {
      return res.status(404).json({ error: `Field with ID ${field_id} not found` });
    }

    // Fetch crops by IDs
    const candidateCrops = [];
    for (const cropId of crop_ids) {
      const crop = await CropsModel.findById(cropId);
      if (!crop) {
        return res.status(400).json({ error: `Crop with ID ${cropId} not found in database` });
      }
      candidateCrops.push(crop);
    }

    const rotationName = name || `${field.name} Candidate Rotation (${candidateCrops.map(c => c.name).join(' -> ')})`;

    const evaluatedRotation = await ScoringEngine.evaluateAndSaveRotation(db, {
      fieldId: field.id,
      name: rotationName,
      seasonSequence: season_sequence,
      candidateCrops: candidateCrops,
      cycleMode: rotation_cycle_mode,
      priorities: priorities
    });

    res.status(201).json({
      ...evaluatedRotation,
      rotation: evaluatedRotation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rotations/compare
 * Evaluate multiple candidate rotations for a field and return side-by-side comparison.
 */
router.post('/compare', async (req, res) => {
  try {
    const { field_id, rotations } = req.body;

    if (!field_id) {
      return res.status(400).json({ error: 'Missing required field: field_id' });
    }
    if (!Array.isArray(rotations) || rotations.length < 2) {
      return res.status(400).json({ error: 'rotations must be an array of at least 2 candidate rotations to compare' });
    }

    const field = await FieldsModel.findById(field_id);
    if (!field) {
      return res.status(404).json({ error: `Field with ID ${field_id} not found` });
    }

    const evaluatedList = [];

    for (const rotReq of rotations) {
      const name = rotReq.name || rotReq.label;
      const season_sequence = rotReq.season_sequence || rotReq.seasons;
      const crop_ids = rotReq.crop_ids;
      const rotation_cycle_mode = rotReq.rotation_cycle_mode || rotReq.cycle_mode || req.body.cycle_mode || 'continue_after_current';
      const priorities = rotReq.priorities || rotReq.weights || req.body.priorities || req.body.weights || {};

      if (!Array.isArray(season_sequence) || !Array.isArray(crop_ids) || season_sequence.length !== crop_ids.length) {
        return res.status(400).json({ error: 'Each rotation must have matching season_sequence and crop_ids arrays' });
      }

      const candidateCrops = [];
      for (const cropId of crop_ids) {
        const crop = await CropsModel.findById(cropId);
        if (!crop) {
          return res.status(400).json({ error: `Crop ID ${cropId} not found` });
        }
        candidateCrops.push(crop);
      }

      const evaluated = await ScoringEngine.evaluateAndSaveRotation(db, {
        fieldId: field.id,
        name: name || `Option (${candidateCrops.map(c => c.name).join(' -> ')})`,
        seasonSequence: season_sequence,
        candidateCrops: candidateCrops,
        cycleMode: rotation_cycle_mode,
        priorities: priorities
      });

      evaluatedList.push(evaluated);
    }

    // Sort descending by overall_score
    evaluatedList.sort((a, b) => (Number(b.overall_score) || 0) - (Number(a.overall_score) || 0));

    const topScore = Number(evaluatedList[0].overall_score) || 0;

    const rankedComparisons = evaluatedList.map((rot, idx) => ({
      rank: idx + 1,
      ranking_label: idx === 0 ? 'Highest-scoring rotation' : `Rank ${idx + 1} candidate`,
      id: rot.id,
      name: rot.name,
      overall_score: Number(rot.overall_score),
      delta_from_top: Math.round((Number(rot.overall_score) - topScore) * 100) / 100,
      feasibility_status: rot.feasibility_status,
      component_scores: {
        water_score: Number(rot.water_score),
        soil_score: Number(rot.soil_score),
        heat_score: Number(rot.heat_score),
        diversity_score: Number(rot.diversity_score),
        profitability_score: rot.profitability_score !== null ? Number(rot.profitability_score) : null
      },
      effective_weights: {
        water: Number(rot.effective_water_weight),
        heat: Number(rot.effective_heat_weight)
      },
      explanation: rot.explanation
    }));

    res.json({
      field_id: field.id,
      field_name: field.name,
      irrigation_available: field.irrigation_available,
      comparisons_count: rankedComparisons.length,
      highest_scoring_rotation_id: evaluatedList[0].id,
      rotations: rankedComparisons,
      comparison: {
        rotations: rankedComparisons,
        field_id: field.id,
        highest_scoring_rotation_id: evaluatedList[0].id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rotations/field/:fieldId
 * Get historical evaluated rotations for a specific field.
 */
router.get('/field/:fieldId', async (req, res) => {
  try {
    const fieldId = parseInt(req.params.fieldId, 10);
    if (isNaN(fieldId)) {
      return res.status(400).json({ error: 'Invalid field ID format' });
    }

    const rotations = await RotationsModel.findByFieldId(fieldId);
    res.json({
      field_id: fieldId,
      count: rotations.length,
      rotations: rotations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * Field Shift - Crops Route (Spec Section 45, 26, 27)
 */
const express = require('express');
const router = express.Router();
const CropsModel = require('../models/cropsModel');

router.get('/', async (req, res) => {
  try {
    const crops = await CropsModel.findAll();
    res.json({
      count: crops.length,
      crops: crops
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const crop = await CropsModel.findById(req.params.id);
    if (!crop) {
      return res.status(404).json({ error: `Crop with ID ${req.params.id} not found` });
    }
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

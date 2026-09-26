/**
 * Field Shift - Health Route (Spec Section 45)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1;');
    res.json({
      status: 'ok',
      version: 'v6.2',
      database: 'connected',
      engine_mode: db.getMode ? db.getMode() : 'postgres',
      uptime_seconds: Math.round(process.uptime() * 10) / 10,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
});

module.exports = router;

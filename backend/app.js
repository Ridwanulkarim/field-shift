/**
 * Field Shift - Express Application (Spec Section 45)
 */
const express = require('express');
const cors = require('cors');
const db = require('./db');

// Models & Seeders for auto-initialization
const { runMigration } = require('./db/migrate');
const { seedReferenceData } = require('./db/seed_reference');
const { seedCropsData } = require('./db/seed_crops');
const { seedDemoFieldsData } = require('./db/seed_demo_fields');
const { seedObservations } = require('./db/seed_observations');
const { seedBaselines } = require('./db/seed_baselines');
const { seedFieldConditionScores } = require('./db/seed_field_condition');

// Routes
const healthRoutes = require('./routes/health');
const cropsRoutes = require('./routes/crops');
const fieldsRoutes = require('./routes/fields');
const rotationsRoutes = require('./routes/rotations');

const app = express();

app.use(cors());
app.use(express.json());

let isDbInitialized = false;

async function initializeDatabase() {
  if (isDbInitialized) return;
  try {
    const res = await db.query('SELECT count(*) FROM fields;');
    if (parseInt(res.rows[0].count, 10) >= 5) {
      isDbInitialized = true;
      return;
    }
  } catch (err) {
    // Schema or table does not exist yet in memory
  }

  console.log('[App] Auto-initializing database schema and reference demo datasets...');
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();
  await seedObservations();
  await seedBaselines();
  await seedFieldConditionScores();
  isDbInitialized = true;
  console.log('[App] Database auto-initialization complete.');
}

// Ensure database is initialized before serving requests
app.use(async (req, res, next) => {
  try {
    if (!isDbInitialized) {
      await initializeDatabase();
    }
    next();
  } catch (err) {
    console.error('[App] Database initialization error:', err);
    res.status(500).json({ error: 'Database initialization failed: ' + err.message });
  }
});

// Mount API routes (Spec Section 45)
app.use('/api/health', healthRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/fields', fieldsRoutes);
app.use('/api/rotations', rotationsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[App Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

module.exports = { app, initializeDatabase };

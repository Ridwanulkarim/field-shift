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
let initPromise = null;

async function loadFromFixtures(fixtures) {
  for (const [table, rows] of Object.entries(fixtures)) {
    if (!rows || !rows.length) continue;
    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => '"' + c + '"').join(', ');
    const chunkSize = 40;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valPlaceholders = [];
      const params = [];
      let pIdx = 1;
      for (const row of chunk) {
        valPlaceholders.push('(' + cols.map(() => '$' + (pIdx++)).join(', ') + ')');
        for (const col of cols) {
          const val = row[col];
          params.push(val != null && typeof val === 'object' ? JSON.stringify(val) : val);
        }
      }
      await db.query(
        'INSERT INTO ' + table + ' (' + colList + ') VALUES ' + valPlaceholders.join(', ') + ' ON CONFLICT DO NOTHING;',
        params
      );
    }
  }
}

async function initializeDatabase() {
  if (isDbInitialized) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
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

    // Fast-path: load precomputed fixtures if available
    let fixtures = null;
    try {
      fixtures = require('./db/fixtures');
    } catch (e) {
      fixtures = null;
    }

    if (fixtures && fixtures.fields && fixtures.fields.length >= 5) {
      console.log('[App] Loading authoritative demo dataset from pre-compiled fixtures...');
      await loadFromFixtures(fixtures);
    } else {
      console.log('[App] Pre-compiled fixtures unavailable; falling back to dynamic computational seeding...');
      await seedReferenceData();
      await seedCropsData();
      await seedDemoFieldsData();
      await seedObservations();
      await seedBaselines();
      await seedFieldConditionScores();
    }

    isDbInitialized = true;
    console.log('[App] Database auto-initialization complete.');
  })().catch((err) => {
    initPromise = null; // Reset so next attempt can retry if this one failed
    console.error('[App] Database auto-initialization error:', err);
    throw err;
  });

  return initPromise;
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

// Info endpoint
app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'ok',
    name: 'Field Shift API',
    description: 'Adapting Farms with NASA Earth Observations',
    version: 'v6.2',
    endpoints: [
      '/api/health',
      '/api/crops',
      '/api/fields',
      '/api/rotations/evaluate',
      '/api/rotations/compare'
    ]
  });
});

// Mount API routes (Spec Section 45)
// Dual-mounted at both /api/* and root /* to ensure seamless serverless routing
app.use('/api/health', healthRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/fields', fieldsRoutes);
app.use('/api/rotations', rotationsRoutes);

app.use('/health', healthRoutes);
app.use('/crops', cropsRoutes);
app.use('/fields', fieldsRoutes);
app.use('/rotations', rotationsRoutes);

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

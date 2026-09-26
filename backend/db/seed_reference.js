/**
 * Field Shift - Seed Reference Tables (Seasons & Drainage Matrix)
 * Spec Section 28 (Bangladesh Seasons) and Section 33 (Drainage Penalties)
 */
const db = require('./index');

async function seedReferenceData() {
  console.log('[Seed] Seeding reference data...');

  // 1. Bangladesh Seasons (Section 28)
  const seasonsData = [
    {
      name: 'Kharif-1',
      start_month: 3,
      start_day: 1,
      end_month: 6,
      end_day: 30,
      approx_days: 122,
      region: 'Bangladesh',
      source_reference: 'Bangladesh Agricultural Research Council (BARC) Agro-Ecological Zones calendar',
      configurable: true
    },
    {
      name: 'Kharif-2',
      start_month: 7,
      start_day: 1,
      end_month: 10,
      end_day: 31,
      approx_days: 123,
      region: 'Bangladesh',
      source_reference: 'Bangladesh Agricultural Research Council (BARC) Agro-Ecological Zones calendar',
      configurable: true
    },
    {
      name: 'Rabi',
      start_month: 11,
      start_day: 1,
      end_month: 2,
      end_day: 28,
      approx_days: 120,
      region: 'Bangladesh',
      source_reference: 'Bangladesh Agricultural Research Council (BARC) Agro-Ecological Zones calendar',
      configurable: true
    }
  ];

  for (const s of seasonsData) {
    await db.query(
      `INSERT INTO seasons (name, start_month, start_day, end_month, end_day, approx_days, region, source_reference, configurable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (name) DO UPDATE SET
         start_month = EXCLUDED.start_month,
         start_day = EXCLUDED.start_day,
         end_month = EXCLUDED.end_month,
         end_day = EXCLUDED.end_day,
         approx_days = EXCLUDED.approx_days;`,
      [s.name, s.start_month, s.start_day, s.end_month, s.end_day, s.approx_days, s.region, s.source_reference, s.configurable]
    );
  }

  // 2. Drainage Penalties (Section 33 Table - All 9 combination rows)
  const drainageData = [
    { waterlogging_tolerance: 'Low', drainage_class: 'good', penalty_points: 0 },
    { waterlogging_tolerance: 'Low', drainage_class: 'moderate', penalty_points: 10 },
    { waterlogging_tolerance: 'Low', drainage_class: 'poor', penalty_points: 20 },
    { waterlogging_tolerance: 'Medium', drainage_class: 'good', penalty_points: 0 },
    { waterlogging_tolerance: 'Medium', drainage_class: 'moderate', penalty_points: 5 }, // Section 33: Medium + Moderate = 5
    { waterlogging_tolerance: 'Medium', drainage_class: 'poor', penalty_points: 10 },
    { waterlogging_tolerance: 'High', drainage_class: 'good', penalty_points: 0 },
    { waterlogging_tolerance: 'High', drainage_class: 'moderate', penalty_points: 0 },
    { waterlogging_tolerance: 'High', drainage_class: 'poor', penalty_points: 0 }
  ];

  for (const d of drainageData) {
    await db.query(
      `INSERT INTO drainage_penalties (waterlogging_tolerance, drainage_class, penalty_points, version)
       VALUES ($1, $2, $3, 'v6.2')
       ON CONFLICT (waterlogging_tolerance, drainage_class, version) DO UPDATE SET
         penalty_points = EXCLUDED.penalty_points;`,
      [d.waterlogging_tolerance, d.drainage_class, d.penalty_points]
    );
  }

  console.log('[Seed] Reference data seeded successfully (Seasons & Drainage Matrix).');
}

async function getSeededDrainagePenalties() {
  const res = await db.query(
    `SELECT waterlogging_tolerance, drainage_class, penalty_points, version
     FROM drainage_penalties
     ORDER BY 
       CASE waterlogging_tolerance 
         WHEN 'Low' THEN 1 
         WHEN 'Medium' THEN 2 
         WHEN 'High' THEN 3 
       END,
       CASE drainage_class 
         WHEN 'good' THEN 1 
         WHEN 'moderate' THEN 2 
         WHEN 'poor' THEN 3 
       END;`
  );
  return res.rows;
}

if (require.main === module) {
  const { runMigration } = require('./migrate');
  runMigration()
    .then(() => seedReferenceData())
    .then(async () => {
      const rows = await getSeededDrainagePenalties();
      console.log('\n--- Actual Seeded Drainage Penalty Rows (Section 33) ---');
      console.table(rows);
      console.log('[Seed] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Failed:', err);
      process.exit(1);
    });
}

module.exports = { seedReferenceData, getSeededDrainagePenalties };

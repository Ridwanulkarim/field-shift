/**
 * Field Shift - Field Condition Scores & Stress Seeding Script (Phase 7)
 * Evaluates standardized stresses across the 61-day analysis window for all 5 demo fields.
 * Updates daily observation records with stress indices and anomalies.
 * Persists Field Condition Score summary records into 'field_condition_scores'.
 * Spec Section 15-25, 43.
 */
const db = require('./index');
const FieldsModel = require('../models/fieldsModel');
const BaselinesModel = require('../models/baselinesModel');
const EarthObservationsModel = require('../models/earthObservationsModel');
const FieldConditionScoresModel = require('../models/fieldConditionScoresModel');
const stressEngine = require('../services/stress/stressEngine');
const config = require('../config');

async function seedFieldConditionScores() {
  console.log('[Seed Field Condition] Computing Stress & Field Condition Scores for Demo Fields...');
  console.log(`[Seed Field Condition] Analysis Window: 2023-12-30 to ${config.DEMO_ANCHOR_DATE} (61 days)\n`);

  const fields = await FieldsModel.findAll();
  const results = [];

  for (const field of fields) {
    // 1. Load stored baselines (Option A - single source of truth)
    const baselines = await BaselinesModel.findByField(field.id);
    
    // 2. Load daily observations for this field in analysis window
    const obsRes = await db.query(
      `SELECT * FROM earth_observations 
       WHERE field_id = $1 AND observation_date BETWEEN '2023-12-30' AND $2 
       ORDER BY observation_date ASC;`,
      [field.id, config.DEMO_ANCHOR_DATE]
    );
    const observations = obsRes.rows;

    // 3. Process stress & condition through StressEngine
    const stressResult = stressEngine.processFieldStressAndCondition(field, baselines, observations);

    // 4. Update daily observations in DB with computed stresses and anomalies
    for (const daily of stressResult.processed_daily_observations) {
      await db.query(
        `UPDATE earth_observations SET
           ndmi_anomaly = $1,
           soil_moisture_anomaly = $2,
           rainfall_anomaly = $3,
           daytime_lst_anomaly = $4,
           nighttime_lst_anomaly = $5,
           hot_day_count = $6,
           vegetation_stress = $7,
           water_stress_index = $8,
           adjusted_water_stress = $9,
           heat_stress_index = $10
         WHERE field_id = $11 AND observation_date = $12;`,
        [
          daily.ndmi_anomaly,
          daily.soil_moisture_anomaly,
          daily.rainfall_anomaly,
          daily.daytime_lst_anomaly,
          daily.nighttime_lst_anomaly,
          daily.hot_day_count,
          daily.vegetation_stress,
          daily.water_stress_index,
          daily.adjusted_water_stress,
          daily.heat_stress_index,
          field.id,
          daily.observation_date
        ]
      );
    }

    // 5. Persist Field Condition Score summary
    const createdScore = await FieldConditionScoresModel.create(stressResult.field_condition_score_record);
    results.push({
      ...stressResult,
      db_score_id: createdScore.id
    });

    console.log(`  ✓ Field ${field.id} (${field.name}):`);
    console.log(`    - Vegetation Stress: ${stressResult.vegetation_stress ?? 'N/A'}`);
    console.log(`    - Water Stress (Raw): ${stressResult.water_stress_index ?? 'N/A'} (Adjusted: ${stressResult.adjusted_water_stress ?? 'N/A'})`);
    console.log(`    - Heat Stress: ${stressResult.heat_stress_index ?? 'N/A'} (Hot days: ${stressResult.hot_days}/${stressResult.valid_days})`);
    console.log(`    - Field Condition Score: ${stressResult.field_condition_score_record.field_condition_score} (${stressResult.label})`);
    console.log(`    - NASA Sources: ${stressResult.field_condition_score_record.nasa_sources_available}/4 (${stressResult.data_quality_status})\n`);
  }

  console.log(`[Seed Field Condition] Successfully seeded ${results.length} field condition scores into 'field_condition_scores'.\n`);
  return results;
}

if (require.main === module) {
  const { runMigration } = require('./migrate');
  const { seedReferenceData } = require('./seed_reference');
  const { seedCropsData } = require('./seed_crops');
  const { seedDemoFieldsData } = require('./seed_demo_fields');
  const { seedObservations } = require('./seed_observations');
  const { seedBaselines } = require('./seed_baselines');

  (async () => {
    await db.resetDb();
    await runMigration();
    await seedReferenceData();
    await seedCropsData();
    await seedDemoFieldsData();
    await seedObservations();
    await seedBaselines();
    const scores = await seedFieldConditionScores();

    console.log('===============================================================================================================');
    console.log('                            FIELD SHIFT - FIELD CONDITION & STRESS TABLE (PHASE 7)');
    console.log('===============================================================================================================');
    console.table(
      scores.map(s => ({
        'Field ID': s.field_id,
        'Field Name': s.field_name.substring(0, 30),
        'Veg Stress': s.vegetation_stress != null ? s.vegetation_stress.toFixed(4) : 'NULL',
        'Water Stress': s.water_stress_index != null ? s.water_stress_index.toFixed(4) : 'NULL',
        'Adj Water': s.adjusted_water_stress != null ? s.adjusted_water_stress.toFixed(4) : 'NULL',
        'Heat Stress': s.heat_stress_index != null ? s.heat_stress_index.toFixed(4) : 'NULL',
        'Hot Days': `${s.hot_days}/${s.valid_days}`,
        'Condition Score': s.field_condition_score_record.field_condition_score != null ? s.field_condition_score_record.field_condition_score.toFixed(1) : 'NULL',
        'Label': s.label || 'NULL',
        'Sources': `${s.field_condition_score_record.nasa_sources_available}/4`,
        'Quality Status': s.data_quality_status
      }))
    );
    process.exit(0);
  })().catch(err => {
    console.error('[Seed Field Condition] Failed:', err);
    process.exit(1);
  });
}

module.exports = { seedFieldConditionScores };

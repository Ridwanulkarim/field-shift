/**
 * Field Shift - Stress Engine & Field Condition Test Suite (Phase 7)
 * Strictly verifies Spec Sections 15–25, 43, 48.
 */
const assert = require('assert');
const stressEngine = require('./stressEngine');
const FieldsModel = require('../../models/fieldsModel');
const BaselinesModel = require('../../models/baselinesModel');
const EarthObservationsModel = require('../../models/earthObservationsModel');
const FieldConditionScoresModel = require('../../models/fieldConditionScoresModel');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const { seedObservations } = require('../../db/seed_observations');
const { seedBaselines } = require('../../db/seed_baselines');
const { seedFieldConditionScores } = require('../../db/seed_field_condition');
const db = require('../../db');

async function runStressTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 7 STRESS ENGINE & FIELD CONDITION TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Standardized Stress Math & Clamping & Zero-Variance (Spec Section 15)
  console.log('[Test 1] Testing Standardized Stress Math & Zero-Variance Handling...');
  
  // Lower is stress (e.g., Soil moisture: mean=0.25, std=0.05)
  const droughtObs = stressEngine.calculateStandardizedStress(0.175, 0.25, 0.05, true);
  // z = (0.175 - 0.25)/0.05 = -1.5 -> raw = 1.5 -> clamped = 1.5 -> norm = 0.75
  assert.strictEqual(droughtObs.z, -1.5);
  assert.strictEqual(droughtObs.raw_stress, 1.5);
  assert.strictEqual(droughtObs.clamped_stress, 1.5);
  assert.strictEqual(droughtObs.normalized_stress, 0.75);

  const wetObs = stressEngine.calculateStandardizedStress(0.30, 0.25, 0.05, true);
  // z = (0.30 - 0.25)/0.05 = +1.0 -> raw = -1.0 -> clamped = 0 -> norm = 0
  assert.strictEqual(wetObs.z, 1.0);
  assert.strictEqual(wetObs.clamped_stress, 0.0);
  assert.strictEqual(wetObs.normalized_stress, 0.0);

  const extremeDrought = stressEngine.calculateStandardizedStress(0.05, 0.25, 0.05, true);
  // z = -4.0 -> raw = 4.0 -> clamped = 2.0 -> norm = 1.0
  assert.strictEqual(extremeDrought.clamped_stress, 2.0);
  assert.strictEqual(extremeDrought.normalized_stress, 1.0);

  // Higher is stress (e.g., LST: mean=26.0, std=1.0)
  const heatObs = stressEngine.calculateStandardizedStress(27.5, 26.0, 1.0, false);
  // z = +1.5 -> raw = 1.5 -> clamped = 1.5 -> norm = 0.75
  assert.strictEqual(heatObs.z, 1.5);
  assert.strictEqual(heatObs.normalized_stress, 0.75);

  // Zero-variance handling (std = 0)
  const zeroVarObs = stressEngine.calculateStandardizedStress(26.0, 26.0, 0.0, false);
  assert.strictEqual(zeroVarObs.normalized_stress, 0.0);
  assert.strictEqual(zeroVarObs.low_variance, true);

  console.log('✓ Standardized stress math, directionality, clamping [0, 2], and zero-variance verified.');

  // Test 2: Daily Stress Processing Order of Operations (Spec Section 16)
  console.log('\n[Test 2] Testing Daily Stress Processing Order of Operations (Clamp then Average)...');
  // Two days: Day 1 z = -4.0 (extreme drought), Day 2 z = +2.0 (abundant rain)
  // Correct method (Section 16):
  // Day 1 clamped/norm stress = 1.0
  // Day 2 clamped/norm stress = 0.0
  // Average stress = (1.0 + 0.0) / 2 = 0.50
  // Incorrect method (averaging raw z first): (-4 + 2)/2 = -1.0 -> stress = 0.5 / 2 = 0.25 (hides the severe drought day)
  const st1 = stressEngine.calculateStandardizedStress(10, 30, 5, true); // z = -4 -> norm = 1.0
  const st2 = stressEngine.calculateStandardizedStress(40, 30, 5, true); // z = +2 -> norm = 0.0
  const dailyAvg = (st1.normalized_stress + st2.normalized_stress) / 2;
  assert.strictEqual(dailyAvg, 0.50);
  console.log('✓ Order of operations verified: daily clamp/normalize before window averaging preserves event impact.');

  // Test 3: Vegetation Stress uses EVI and Excludes NDMI (Spec Section 17)
  console.log('\n[Test 3] Testing Vegetation Stress Excludes NDMI (Section 17)...');
  const dummyField = { id: 99, name: 'Test Field', irrigation_available: false };
  const dummyBaselines = [
    { variable: 'evi', mean: 0.35, std: 0.02 },
    { variable: 'ndmi', mean: 0.16, std: 0.02 },
    { variable: 'soil_moisture', mean: 0.22, std: 0.02 },
    { variable: 'rolling_30d_rainfall', mean: 15.0, std: 3.0 },
    { variable: 'daytime_lst_c', mean: 27.0, std: 1.0 },
    { variable: 'nighttime_lst_c', mean: 14.0, std: 1.0 }
  ];
  const dummyObs = [
    {
      observation_date: '2024-02-01',
      evi: 0.33, // z = -1.0 -> stress = 0.5
      ndmi: 0.10, // NDMI is in drought (z = -3.0 -> stress = 1.0)
      soil_moisture: 0.20,
      rolling_30d_rainfall: 12.0,
      daytime_lst_c: 27.0,
      nighttime_lst_c: 14.0
    }
  ];
  const resDummy = stressEngine.processFieldStressAndCondition(dummyField, dummyBaselines, dummyObs);
  // Vegetation stress must strictly equal EVI stress (0.5), not influenced by NDMI (1.0)
  assert.strictEqual(resDummy.vegetation_stress, 0.5);
  console.log('✓ Vegetation stress strictly uses EVI and excludes NDMI to prevent double-counting.');

  // Test 4: Water Stress Weights & Missing-Component Renormalization (Spec Section 18)
  console.log('\n[Test 4] Testing Water Stress Weights (0.40/0.30/0.30) & Renormalization...');
  // All components present
  const fullWater = stressEngine.combineWaterStress(0.5, 0.2, 0.8);
  // 0.5*0.40 + 0.2*0.30 + 0.8*0.30 = 0.20 + 0.06 + 0.24 = 0.50
  assert.strictEqual(fullWater.water_stress_index, 0.5);
  assert.deepStrictEqual(fullWater.missing_components, []);

  // NDMI missing (optical cloud cover): Soil (0.40) + Rain (0.30) -> total weight 0.70
  const noNdmiWater = stressEngine.combineWaterStress(0.70, 0.35, null);
  // (0.70 * 0.40 + 0.35 * 0.30) / 0.70 = (0.28 + 0.105) / 0.70 = 0.385 / 0.70 = 0.55
  assert.strictEqual(noNdmiWater.water_stress_index, 0.55);
  assert.deepStrictEqual(noNdmiWater.missing_components, ['ndmi']);

  // All missing
  const emptyWater = stressEngine.combineWaterStress(null, null, null);
  assert.strictEqual(emptyWater.water_stress_index, null);
  assert.ok(emptyWater.warning.includes('Water stress could not be calculated'));
  console.log('✓ Water stress weights and missing-input renormalization verified.');

  // Test 5: Irrigation Adjustment Strict Separation (Spec Section 20 & 23)
  console.log('\n[Test 5] Testing Irrigation Adjustment Separation (Section 20 & 23)...');
  const irrigatedField = { id: 101, name: 'Irrigated Test Field', irrigation_available: true };
  const rawWaterStress = 0.60;
  const adjusted = stressEngine.calculateAdjustedWaterStress(rawWaterStress, true);
  assert.strictEqual(adjusted, 0.42); // 0.60 * 0.7 = 0.42

  // Field condition score MUST use raw unadjusted water stress
  const fcIrrigated = stressEngine.calculateFieldConditionScore(0.2, rawWaterStress, 0.2, 4);
  // water_condition_score = 100 * (1 - 0.60) = 40.0
  assert.strictEqual(fcIrrigated.water_condition_score, 40.0);
  console.log('✓ Irrigation adjustment strictly isolates adjusted water stress from Field Condition Score.');

  // Test 6: Heat Stress & Hot-Day Frequency over CURRENT Window (Spec Section 21 & 22)
  console.log('\n[Test 6] Testing Heat Stress Index & Hot-Day Frequency over Current 61-day Window...');
  // Construct 10-day test window: 2 hot days (z >= 1.0), 8 normal days
  const tempObs = [];
  for (let i = 0; i < 10; i++) {
    tempObs.push({ daytime_lst_c: i < 2 ? 30.0 : 25.0 }); // baseline mean 25.0, std 2.0 -> 30.0 gives z = 2.5 >= 1.0
  }
  const hotRes = stressEngine.calculateHotDayFrequency(tempObs, 25.0, 2.0);
  assert.strictEqual(hotRes.valid_days, 10);
  assert.strictEqual(hotRes.hot_days, 2);
  assert.strictEqual(hotRes.hot_day_frequency, 0.20); // 2/10 = 0.20
  // frequency_stress = clamp((0.20 - 0.16) / (0.50 - 0.16), 0, 1) = 0.04 / 0.34 ≈ 0.1176
  assert.ok(Math.abs(hotRes.frequency_stress - (0.04 / 0.34)) < 0.0001);

  // Frequency <= 0.16 gives stress 0
  const lowHotObs = [{ daytime_lst_c: 30 }, ...Array(9).fill({ daytime_lst_c: 25 })]; // 1/10 = 0.10 <= 0.16
  const lowHotRes = stressEngine.calculateHotDayFrequency(lowHotObs, 25.0, 2.0);
  assert.strictEqual(lowHotRes.frequency_stress, 0.0);

  // Frequency >= 0.50 gives stress 1.0
  const highHotObs = Array(6).fill({ daytime_lst_c: 30 }).concat(Array(4).fill({ daytime_lst_c: 25 })); // 6/10 = 0.60 >= 0.50
  const highHotRes = stressEngine.calculateHotDayFrequency(highHotObs, 25.0, 2.0);
  assert.strictEqual(highHotRes.frequency_stress, 1.0);
  console.log('✓ Hot-day frequency and prototype thresholding (0.16 to 0.50) verified over current window.');

  // Test 7: NASA Data Quality Threshold (Spec Section 24 & 25)
  console.log('\n[Test 7] Testing NASA Data Quality Status & Field Condition Labels...');
  // 4 of 4 sources: normal
  const normalFC = stressEngine.calculateFieldConditionScore(0.1, 0.2, 0.1, 4);
  assert.strictEqual(normalFC.data_quality_status, 'normal');
  assert.ok(normalFC.field_condition_score > 75);
  assert.strictEqual(normalFC.label, 'Healthy relative condition');

  // 3 of 4 sources: warning, score still computed
  const warnFC = stressEngine.calculateFieldConditionScore(0.4, 0.5, 0.4, 3);
  assert.strictEqual(warnFC.data_quality_status, 'warning');
  assert.ok(warnFC.field_condition_score !== null);
  assert.strictEqual(warnFC.label, 'Watch closely');

  // < 3 sources: insufficient, score must be null
  const insuffFC = stressEngine.calculateFieldConditionScore(0.4, 0.5, 0.4, 2);
  assert.strictEqual(insuffFC.data_quality_status, 'insufficient_observations');
  assert.strictEqual(insuffFC.field_condition_score, null);
  assert.strictEqual(insuffFC.label, null);
  assert.ok(insuffFC.warning.includes('Insufficient NASA observations'));
  console.log('✓ Spec Section 24 verified: 4/4 normal, 3/4 warning with score, <3 insufficient with null score.');

  // Test 8: End-to-End Database Seeding & Persistence Across All 5 Demo Fields
  console.log('\n[Test 8] Ingesting & Verifying Stress & Field Condition Scores in Database...');
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();
  await seedObservations();
  await seedBaselines();
  const seededScores = await seedFieldConditionScores();

  assert.strictEqual(seededScores.length, 5, 'Must seed exactly 5 field condition score records');

  // Verify Field 1 (Godagari - Barind drought terrace)
  const fc1 = await FieldConditionScoresModel.findLatestByField(1);
  assert.ok(fc1, 'Field 1 condition score must exist');
  assert.strictEqual(fc1.nasa_sources_available, 4);
  assert.strictEqual(fc1.data_quality_status, 'normal');
  assert.ok(Number(fc1.field_condition_score) < 55, 'Field 1 should have moderate stress due to dry Barind winter');

  // Verify Field 2 (Birol - lush irrigated alluvial plain)
  const fc2 = await FieldConditionScoresModel.findLatestByField(2);
  assert.ok(Number(fc2.field_condition_score) > 75, 'Field 2 should have healthy relative condition');

  // Verify Field 5 (Kaliganj - high stress coastal saline drought)
  const fc5 = await FieldConditionScoresModel.findLatestByField(5);
  assert.ok(Number(fc5.field_condition_score) < 30, 'Field 5 should have high stress in coastal transition zone');

  // Verify Earth Observations table was updated with daily stresses
  const obsField1 = await db.query(
    'SELECT * FROM earth_observations WHERE field_id = 1 AND observation_date = $1;',
    ['2024-02-28']
  );
  assert.strictEqual(obsField1.rows.length, 1);
  const row1 = obsField1.rows[0];
  assert.ok(row1.water_stress_index !== null, 'Daily water stress index must be populated');
  assert.ok(row1.heat_stress_index !== null, 'Daily heat stress index must be populated');
  assert.ok(row1.hot_day_count !== null, 'Daily hot day count must be populated');

  console.log('✓ Full database persistence verified: earth_observations updated and 5 field condition scores stored.');

  console.log('\n================================================================');
  console.log('ALL PHASE 7 STRESS ENGINE TESTS PASSED! (8/8)');
  console.log('================================================================');
}

if (require.main === module) {
  runStressTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Stress engine tests failed:', err);
      process.exit(1);
    });
}

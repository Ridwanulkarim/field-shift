/**
 * Field Shift - Soil Engine Test Suite (Phase 8)
 * Strictly verifies Spec Sections 32–35:
 * - Base Soil Health Score calculation
 * - 3x3 Drainage Penalty Matrix & Unknown Tolerance handling
 * - pH Penalty Mapping (10 pts/unit outside range, max 20)
 * - Final Soil Score clamping and penalty subtraction
 * - Candidate rotation evaluation across demo fields
 */
const assert = require('assert');
const soilEngine = require('./soilEngine');
const CropsModel = require('../../models/cropsModel');
const FieldsModel = require('../../models/fieldsModel');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const db = require('../../db');

async function runSoilTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 8 SOIL COMPATIBILITY TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Drainage Penalty Matrix Mapping (Spec Section 33)
  console.log('[Test 1] Testing Drainage Penalty Matrix Mapping (3x3)...');
  // Low tolerance
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Low', 'good'), 0);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Low', 'moderate'), 10);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Low', 'poor'), 20);
  // Medium tolerance
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Medium', 'good'), 0);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Medium', 'moderate'), 5);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('Medium', 'poor'), 10);
  // High tolerance
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('High', 'good'), 0);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('High', 'moderate'), 0);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('High', 'poor'), 0);
  // Unknown tolerance gives null (never zero)
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty(null, 'poor'), null);
  assert.strictEqual(soilEngine.calculateCropDrainagePenalty('unknown', 'poor'), null);
  console.log('✓ Drainage penalty 3x3 matrix and unknown tolerance handling verified.');

  // Test 2: pH Penalty Mapping (Spec Section 34)
  console.log('\n[Test 2] Testing pH Penalty Mapping (10 pts per unit outside range, max 20)...');
  // Within range [6.0, 7.5], pH = 6.5 -> 0
  assert.strictEqual(soilEngine.calculateCropPhPenalty(6.5, 6.0, 7.5), 0.0);
  // Below range: pH = 5.5, range [6.0, 7.5] -> distance 0.5 -> penalty 5.0
  assert.strictEqual(soilEngine.calculateCropPhPenalty(5.5, 6.0, 7.5), 5.0);
  // Above range: pH = 8.2, range [6.0, 7.5] -> distance 0.7 -> penalty 7.0
  assert.strictEqual(soilEngine.calculateCropPhPenalty(8.2, 6.0, 7.5), 7.0);
  // Cap at 20: pH = 4.0, range [6.5, 7.5] -> distance 2.5 -> min(20, 25) = 20.0
  assert.strictEqual(soilEngine.calculateCropPhPenalty(4.0, 6.5, 7.5), 20.0);
  // Unknown pH range gives null (never invented)
  assert.strictEqual(soilEngine.calculateCropPhPenalty(6.5, null, 7.5), null);
  assert.strictEqual(soilEngine.calculateCropPhPenalty(6.5, 6.0, null), null);
  console.log('✓ pH penalty formula, linear distance scaling, and 20 pt ceiling verified.');

  // Test 3: Database Setup & Crop Retrieval
  console.log('\n[Test 3] Loading Seeded Crops & Demo Fields...');
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();

  const allCrops = await CropsModel.findAll();
  const allFields = await FieldsModel.findAll();

  const cropMap = {};
  for (const c of allCrops) {
    cropMap[c.name] = c;
  }

  const field1 = allFields.find(f => f.id === 1); // Godagari (Barind, good drainage, pH 5.50)
  const field3 = allFields.find(f => f.id === 3); // Muktagacha (Lowland basin, poor drainage, pH 6.50)
  const field5 = allFields.find(f => f.id === 5); // Kaliganj (Coastal transition, moderate drainage, pH 7.60)

  // Test 4: Candidate Rotation 1 on Field 3 (Muktagacha Floodplain: Boro Rice + T. Aman Rice)
  console.log('\n[Test 4] Candidate Rotation 1 on Field 3 (Boro Rice + T. Aman Rice in Poor Drainage)...');
  const rot1Crops = [cropMap['Boro Rice'], cropMap['T. Aman Rice']];
  const rot1Res = soilEngine.calculateRotationSoilScore(rot1Crops, field3);

  // Both have High tolerance in poor drainage -> drainage penalty = 0
  // Field pH 6.50 is within both ranges -> pH penalty = 0
  assert.strictEqual(rot1Res.base_soil_health_score, 25.0);
  assert.strictEqual(rot1Res.drainage_penalty, 0.0);
  assert.strictEqual(rot1Res.ph_penalty, 0.0);
  assert.strictEqual(rot1Res.soil_score_final, 25.0);
  assert.strictEqual(rot1Res.quality_flag, 'usable');
  console.log(`✓ Field 3 Rotation 1 verified: base=${rot1Res.base_soil_health_score}, drain=${rot1Res.drainage_penalty}, ph=${rot1Res.ph_penalty}, final=${rot1Res.soil_score_final}`);

  // Test 5: Candidate Rotation 2 on Field 3 (Wheat + Mung Bean + T. Aman Rice in Poor Drainage)
  console.log('\n[Test 5] Candidate Rotation 2 on Field 3 (Wheat + Mung Bean + T. Aman in Poor Drainage)...');
  const rot2Crops = [cropMap['Wheat'], cropMap['Mung Bean'], cropMap['T. Aman Rice']];
  const rot2Res = soilEngine.calculateRotationSoilScore(rot2Crops, field3);

  // Wheat (Low tolerance in poor -> 20), Mung Bean (Low in poor -> 20), T. Aman (High in poor -> 0)
  // Average drainage penalty = (20 + 20 + 0) / 3 = 13.33
  // Base health = (25 + 75 + 25) / 3 = 41.67
  // Final = 41.67 - 13.33 = 28.34
  assert.strictEqual(rot2Res.base_soil_health_score, 41.67);
  assert.strictEqual(rot2Res.drainage_penalty, 13.33);
  assert.strictEqual(rot2Res.ph_penalty, 0.0);
  assert.strictEqual(rot2Res.soil_score_final, 28.34);
  console.log(`✓ Field 3 Rotation 2 verified: base=${rot2Res.base_soil_health_score}, drain=-${rot2Res.drainage_penalty}, ph=${rot2Res.ph_penalty}, final=${rot2Res.soil_score_final}`);

  // Test 6: Candidate Rotation 3 on Field 1 (Godagari Barind: Chickpea + Mung Bean in Moderate Drainage, pH 5.80)
  console.log('\n[Test 6] Candidate Rotation 3 on Field 1 (Chickpea + Mung Bean in Moderate Drainage, pH 5.80)...');
  const rot3Crops = [cropMap['Chickpea'], cropMap['Mung Bean']];
  const rot3Res = soilEngine.calculateRotationSoilScore(rot3Crops, field1);

  // Field 1 drainage is 'moderate': Low tolerance crops incur 10 pt drainage penalty each -> average 10.0
  // Field 1 pH is 5.80:
  // Chickpea range [6.2, 7.8] -> distance 0.40 -> penalty 4.0
  // Mung Bean range [6.0, 7.5] -> distance 0.20 -> penalty 2.0
  // Average pH penalty = (4.0 + 2.0) / 2 = 3.0
  // Base health = (75 + 75) / 2 = 75.0
  // Final = 75.0 - 10.0 - 3.0 = 62.0
  assert.strictEqual(rot3Res.base_soil_health_score, 75.0);
  assert.strictEqual(rot3Res.drainage_penalty, 10.0);
  assert.strictEqual(rot3Res.ph_penalty, 3.0);
  assert.strictEqual(rot3Res.soil_score_final, 62.0);
  console.log(`✓ Field 1 Rotation 3 verified: base=${rot3Res.base_soil_health_score}, drain=-${rot3Res.drainage_penalty}, ph=-${rot3Res.ph_penalty}, final=${rot3Res.soil_score_final}`);

  // Test 7: Candidate Rotation 4 on Field 5 (Kaliganj: Potato + Maize in Alkaline Soil pH 7.60, Moderate Drainage)
  console.log('\n[Test 7] Candidate Rotation 4 on Field 5 (Potato + Maize in Alkaline Saline pH 7.60)...');
  const rot4Crops = [cropMap['Potato'], cropMap['Maize']];
  const rot4Res = soilEngine.calculateRotationSoilScore(rot4Crops, field5);

  // Potato: benefit 25, Low tolerance in moderate -> 10 penalty. pH [5.2, 6.5] vs 7.60 -> dist 1.1 -> 11.0 penalty.
  // Maize: benefit 50, Medium in moderate -> 5 penalty. pH [5.8, 7.2] vs 7.60 -> dist 0.4 -> 4.0 penalty.
  // Base = (25 + 50) / 2 = 37.5
  // Drainage = (10 + 5) / 2 = 7.5
  // pH = (11.0 + 4.0) / 2 = 7.5
  // Final = 37.5 - 7.5 - 7.5 = 22.5
  assert.strictEqual(rot4Res.base_soil_health_score, 37.5);
  assert.strictEqual(rot4Res.drainage_penalty, 7.5);
  assert.strictEqual(rot4Res.ph_penalty, 7.5);
  assert.strictEqual(rot4Res.soil_score_final, 22.5);
  console.log(`✓ Field 5 Rotation 4 verified: base=${rot4Res.base_soil_health_score}, drain=-${rot4Res.drainage_penalty}, ph=-${rot4Res.ph_penalty}, final=${rot4Res.soil_score_final}`);

  // Test 8: Unknown Trait Handling (Spec Section 33 & 34)
  console.log('\n[Test 8] Testing Unknown Trait Handling (null tolerance / range -> limited flag)...');
  const unknownCrop = {
    name: 'Experimental Crop',
    soil_health_benefit: 60,
    waterlogging_tolerance: null, // unknown tolerance
    min_soil_ph: null,             // unknown pH range
    max_soil_ph: null
  };
  const unkRes = soilEngine.calculateRotationSoilScore([unknownCrop], field3);
  assert.strictEqual(unkRes.base_soil_health_score, 60.0);
  assert.strictEqual(unkRes.drainage_penalty, null); // Must be null, not 0!
  assert.strictEqual(unkRes.ph_penalty, null);       // Must be null, not 0!
  assert.strictEqual(unkRes.soil_score_final, 60.0); // Only available penalties subtracted
  assert.strictEqual(unkRes.quality_flag, 'limited');
  console.log('✓ Unknown trait handling verified: unknown tolerance/pH produces null penalty and flags limited quality.');

  console.log('\n================================================================');
  console.log('ALL PHASE 8 SOIL COMPATIBILITY TESTS PASSED! (8/8)');
  console.log('================================================================');
}

if (require.main === module) {
  runSoilTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Soil engine tests failed:', err);
      process.exit(1);
    });
}

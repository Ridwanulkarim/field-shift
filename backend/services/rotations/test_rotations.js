/**
 * Field Shift - Rotation Feasibility & Diversity Test Suite (Phase 9)
 * Strictly verifies Spec Sections 28–31:
 * - Spec Section 28: Bangladesh Seasons duration
 * - Spec Section 29: Seasonal Feasibility & Infeasibility (e.g. Boro Rice 145d > Rabi 120d)
 * - Spec Section 30: Rotation Cycle Context ('continue_after_current' vs 'start_new_cycle')
 * - Spec Section 31: Diversity Score with exact spec reference worked example (36.7)
 * - All 5 Demo Fields actual current_crop verification
 */
const assert = require('assert');
const rotationEngine = require('./rotationEngine');
const CropsModel = require('../../models/cropsModel');
const FieldsModel = require('../../models/fieldsModel');
const SeasonsModel = require('../../models/seasonsModel');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const db = require('../../db');

async function runRotationTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 9 ROTATION FEASIBILITY & DIVERSITY TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Exact Spec Reference Case for Diversity Score (Spec Section 31)
  console.log('[Test 1] Testing Exact Spec Section 31 Reference Case (Rice -> Rice, Mung Bean, Lentil = 36.7)...');
  const refContextCrop = { name: 'Rice', crop_family: 'Cereal' };
  const refCandidateCrops = [
    { name: 'Rice', crop_family: 'Cereal' },
    { name: 'Mung Bean', crop_family: 'Legume' },
    { name: 'Lentil', crop_family: 'Legume' }
  ];

  const divResult = rotationEngine.calculateDiversityScore(refCandidateCrops, refContextCrop.crop_family);
  // Spec Section 31:
  // Candidate families: Cereal, Legume, Legume -> 2 unique families out of 3 crops
  // unique_family_ratio = 2/3 = 0.6667 -> base_diversity_score = 66.7
  assert.strictEqual(divResult.base_diversity_score, 66.7);
  // Sequence with context: [Cereal, Cereal, Legume, Legume]
  // Repeats: Cereal-Cereal (15 pts) + Legume-Legume (15 pts) = 30 pts
  assert.strictEqual(divResult.adjacent_repeats, 2);
  assert.strictEqual(divResult.repeat_penalty, 30.0);
  // final_diversity_score = clamp(66.7 - 30, 0, 100) = 36.7
  assert.strictEqual(divResult.final_diversity_score, 36.7);
  console.log(`✓ Spec reference case exact match: base=${divResult.base_diversity_score}, penalty=${divResult.repeat_penalty}, final=${divResult.final_diversity_score}`);

  // Test 2: Infeasible Rotation (Boro Rice 145d in Rabi 120d) (Spec Section 29)
  console.log('\n[Test 2] Testing Seasonal Infeasibility: Boro Rice (145d) in Rabi (120d)...');
  const boroRiceCrop = {
    name: 'Boro Rice',
    crop_family: 'Cereal',
    growing_days: 145,
    suitable_seasons: ['Rabi']
  };
  const infeasibleSeq = [
    { season: 'Rabi', crop: boroRiceCrop }
  ];
  const seasonsMap = {
    'Rabi': { name: 'Rabi', approx_days: 120 },
    'Kharif-1': { name: 'Kharif-1', approx_days: 122 },
    'Kharif-2': { name: 'Kharif-2', approx_days: 123 }
  };

  const infeasibleRes = rotationEngine.checkSeasonalFeasibility(infeasibleSeq, seasonsMap);
  assert.strictEqual(infeasibleRes.is_feasible, false);
  assert.strictEqual(infeasibleRes.feasibility_status, 'Not seasonally feasible');
  assert.ok(infeasibleRes.failure_reasons.length > 0);
  assert.ok(
    infeasibleRes.failure_reasons[0].includes('growing days (145d) exceeds Rabi duration (120d)'),
    `Expected failure reason to mention 145d > 120d, got: ${infeasibleRes.failure_reasons[0]}`
  );
  console.log(`✓ Infeasible candidate correctly rejected: "${infeasibleRes.failure_reasons[0]}"`);

  // Test 3: Infeasible Rotation (Unsuitable Season: Jute in Rabi)
  console.log('\n[Test 3] Testing Seasonal Infeasibility: Unsuitable Season (Jute in Rabi)...');
  const juteCrop = {
    name: 'Jute',
    crop_family: 'Fibre',
    growing_days: 115,
    suitable_seasons: ['Kharif-1'] // Not suitable for Rabi
  };
  const unsuitSeq = [{ season: 'Rabi', crop: juteCrop }];
  const unsuitRes = rotationEngine.checkSeasonalFeasibility(unsuitSeq, seasonsMap);
  assert.strictEqual(unsuitRes.is_feasible, false);
  assert.strictEqual(unsuitRes.feasibility_status, 'Not seasonally feasible');
  assert.ok(unsuitRes.failure_reasons[0].includes('not suitable for season Rabi'));
  console.log(`✓ Unsuitable season candidate rejected: "${unsuitRes.failure_reasons[0]}"`);

  // Test 4: Feasible Multi-Season Rotation
  console.log('\n[Test 4] Testing Feasible Multi-Season Rotation (Wheat -> Mung Bean -> T. Aman Rice)...');
  const wheatCrop = { name: 'Wheat', crop_family: 'Cereal', growing_days: 108, suitable_seasons: ['Rabi'] };
  const mungCrop = { name: 'Mung Bean', crop_family: 'Legume', growing_days: 65, suitable_seasons: ['Kharif-1', 'Kharif-2', 'Rabi'] };
  const amanCrop = { name: 'T. Aman Rice', crop_family: 'Cereal', growing_days: 115, suitable_seasons: ['Kharif-2'] };

  const feasibleSeq = [
    { season: 'Rabi', crop: wheatCrop },
    { season: 'Kharif-1', crop: mungCrop },
    { season: 'Kharif-2', crop: amanCrop }
  ];
  const feasibleRes = rotationEngine.checkSeasonalFeasibility(feasibleSeq, seasonsMap);
  assert.strictEqual(feasibleRes.is_feasible, true);
  assert.strictEqual(feasibleRes.feasibility_status, 'Seasonally feasible');
  assert.strictEqual(feasibleRes.failure_reasons.length, 0);
  console.log('✓ Multi-season feasible rotation successfully validated (all growing days fit season bounds).');

  // Test 5: Verify Actual Database Setup & Demo Fields
  console.log('\n[Test 5] Loading Seeded Demo Fields from Database...');
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();

  const allFields = await FieldsModel.findAll();
  const allCrops = await CropsModel.findAll();
  const cropMap = {};
  for (const c of allCrops) cropMap[c.name] = c;

  assert.strictEqual(allFields.length, 5);

  // Test 6: Verify Actual current_crop Repeat Context for All 5 Demo Fields (Spec Section 30)
  console.log('\n[Test 6] Verifying Actual current_crop Repeat Context Across All 5 Demo Fields...');
  const expectedFieldStates = [
    { id: 1, current_crop: 'Chickpea', current_family: 'Legume', prev_crop: 'T. Aman Rice', prev_family: 'Cereal' },
    { id: 2, current_crop: 'Wheat', current_family: 'Cereal', prev_crop: 'T. Aman Rice', prev_family: 'Cereal' },
    { id: 3, current_crop: 'Boro Rice', current_family: 'Cereal', prev_crop: 'T. Aman Rice', prev_family: 'Cereal' },
    { id: 4, current_crop: 'Mustard', current_family: 'Oilseed', prev_crop: 'T. Aman Rice', prev_family: 'Cereal' },
    { id: 5, current_crop: 'Lentil', current_family: 'Legume', prev_crop: 'T. Aman Rice', prev_family: 'Cereal' }
  ];

  for (const exp of expectedFieldStates) {
    const field = allFields.find(f => f.id === exp.id);
    assert.ok(field, `Field ${exp.id} must exist in DB`);
    assert.strictEqual(field.current_crop, exp.current_crop);
    assert.strictEqual(field.current_crop_family, exp.current_family);
    assert.strictEqual(field.previous_crop, exp.prev_crop);
    assert.strictEqual(field.previous_crop_family, exp.prev_family);

    // Test cycle mode: 'continue_after_current'
    const contContext = rotationEngine.getRepeatContext(field, 'continue_after_current');
    assert.strictEqual(contContext.repeat_context_crop, exp.current_crop);
    assert.strictEqual(contContext.repeat_context_family, exp.current_family);
    assert.strictEqual(contContext.repeat_context_type, 'current');

    // Test cycle mode: 'start_new_cycle'
    const startContext = rotationEngine.getRepeatContext(field, 'start_new_cycle');
    assert.strictEqual(startContext.repeat_context_crop, exp.prev_crop);
    assert.strictEqual(startContext.repeat_context_family, exp.prev_family);
    assert.strictEqual(startContext.repeat_context_type, 'previous');

    console.log(`  ✓ Field ${field.id} (${field.name.substring(0, 25)}): current=${field.current_crop} (${field.current_crop_family}), prev=${field.previous_crop} (${field.previous_crop_family})`);
  }

  // Test 7: Impact of Cycle Mode on Diversity Penalty
  console.log('\n[Test 7] Testing Cycle Mode Impact on Adjacent Repeat Penalty...');
  const field4 = allFields.find(f => f.id === 4); // Mustard (Oilseed), prev: T. Aman Rice (Cereal)
  const candidateMustardSeq = [cropMap['Mustard'], cropMap['Mung Bean']]; // [Oilseed, Legume]

  // Mode 1: continue_after_current -> context is Mustard (Oilseed)
  // Sequence: [Oilseed (context), Oilseed (candidate 1), Legume (candidate 2)]
  // Oilseed == Oilseed -> 1 repeat penalty (15 pts)!
  const divCont = rotationEngine.calculateDiversityScore(candidateMustardSeq, field4.current_crop_family);
  assert.strictEqual(divCont.adjacent_repeats, 1);
  assert.strictEqual(divCont.repeat_penalty, 15.0);
  assert.strictEqual(divCont.final_diversity_score, 85.0); // 100 - 15 = 85.0

  // Mode 2: start_new_cycle -> context is T. Aman Rice (Cereal)
  // Sequence: [Cereal (context), Oilseed (candidate 1), Legume (candidate 2)]
  // Cereal != Oilseed != Legume -> 0 repeat penalty!
  const divStart = rotationEngine.calculateDiversityScore(candidateMustardSeq, field4.previous_crop_family);
  assert.strictEqual(divStart.adjacent_repeats, 0);
  assert.strictEqual(divStart.repeat_penalty, 0.0);
  assert.strictEqual(divStart.final_diversity_score, 100.0);

  console.log('✓ Cycle mode repeat context correctly alters adjacent repeat penalty (15 pts vs 0 pts).');

  console.log('\n================================================================');
  console.log('ALL PHASE 9 ROTATION ENGINE TESTS PASSED! (7/7)');
  console.log('================================================================');
}

if (require.main === module) {
  runRotationTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Rotation engine tests failed:', err);
      process.exit(1);
    });
}

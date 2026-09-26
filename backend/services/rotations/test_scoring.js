/**
 * Field Shift - Rotation Scoring & Explanation Test Suite (Phase 10 & 11)
 * Strictly verifies Spec Sections 36–41, 43, 48–50, and Fixtures 1, 2, 3, 16.
 */
const assert = require('assert');
const ScoringEngine = require('./scoringEngine');
const RotationsModel = require('../../models/rotationsModel');
const db = require('../../db');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const { seedObservations } = require('../../db/seed_observations');
const { seedBaselines } = require('../../db/seed_baselines');
const { seedFieldConditionScores } = require('../../db/seed_field_condition');

async function runScoringTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 10 & 11 ROTATION SCORING & EXPLANATION TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Fixture 1 (z-score Table & Clamping, Spec Section 49)
  console.log('[Test 1] Testing Fixture 1: z-score and Clamping Math...');
  const stressEngine = require('../stress/stressEngine');
  // Baseline mean 100, std 10, lower-is-worse
  const fx1_100 = stressEngine.calculateStandardizedStress(100, 100, 10, true);
  assert.strictEqual(fx1_100.z, 0);
  assert.strictEqual(fx1_100.normalized_stress, 0);

  const fx1_90 = stressEngine.calculateStandardizedStress(90, 100, 10, true);
  assert.strictEqual(fx1_90.z, -1);
  assert.strictEqual(fx1_90.normalized_stress, 0.5);

  const fx1_70 = stressEngine.calculateStandardizedStress(70, 100, 10, true);
  assert.strictEqual(fx1_70.z, -3);
  assert.strictEqual(fx1_70.clamped_stress, 2.0); // clamped at 2
  assert.strictEqual(fx1_70.normalized_stress, 1.0);

  const fx1_110 = stressEngine.calculateStandardizedStress(110, 100, 10, true);
  assert.strictEqual(fx1_110.z, 1.0);
  assert.strictEqual(fx1_110.clamped_stress, 0.0); // clamped at 0
  assert.strictEqual(fx1_110.normalized_stress, 0.0);

  const fx1_std0 = stressEngine.calculateStandardizedStress(100, 100, 0, true);
  assert.strictEqual(fx1_std0.normalized_stress, 0.0);
  assert.strictEqual(fx1_std0.low_variance, true);
  console.log('✓ Fixture 1 verified: mean=100, std=10 correctly matches all 4 clamp cases and std=0 handling.\n');

  // Test 2: Fixture 2 (Multipliers Math, Spec Section 49)
  console.log('[Test 2] Testing Fixture 2: NASA Multipliers (1.10/1.10 and 1.80/1.70)...');
  // irrigation_available = false
  const fx2_mild = ScoringEngine.calculateEffectiveWeights({ water: 3, heat: 4 }, 0.10, 0.10);
  assert.strictEqual(fx2_mild.water_multiplier, 1.10);
  assert.strictEqual(fx2_mild.heat_multiplier, 1.10);

  const fx2_severe = ScoringEngine.calculateEffectiveWeights({ water: 3, heat: 4 }, 0.80, 0.70);
  assert.strictEqual(fx2_severe.water_multiplier, 1.80);
  assert.strictEqual(fx2_severe.heat_multiplier, 1.70);
  console.log('✓ Fixture 2 verified: (0.10, 0.10) -> (1.10, 1.10) and (0.80, 0.70) -> (1.80, 1.70).\n');

  // Test 3: Fixture 3 (Irrigation-Only Toggle Isolation)
  console.log('[Test 3] Testing Fixture 3: Irrigation-Only Toggle on Same NASA Data...');
  const rawStress = 0.80;
  const nonIrrigatedWeights = ScoringEngine.calculateEffectiveWeights({ water: 3 }, rawStress, 0.10);
  const irrigatedStress = rawStress * 0.7; // 0.56
  const irrigatedWeights = ScoringEngine.calculateEffectiveWeights({ water: 3 }, irrigatedStress, 0.10);

  assert.strictEqual(nonIrrigatedWeights.water_multiplier, 1.80);
  assert.strictEqual(nonIrrigatedWeights.effective_water_weight, 5.40);

  assert.strictEqual(irrigatedWeights.water_multiplier, 1.56);
  assert.strictEqual(irrigatedWeights.effective_water_weight, 4.68);
  console.log('✓ Fixture 3 verified: irrigation factor 0.7x strictly reduces effective water weight (5.40 -> 4.68).\n');

  // Test 4: Section 40 Ranking-Shift Fixture
  console.log('[Test 4] Testing Section 40 Ranking-Shift Reference Case (440 vs 484 -> 632 vs 580)...');
  const rotA = { water_score: 80, heat_score: 40, soil_score: null, diversity_score: null, profitability_score: null };
  const rotB = { water_score: 40, heat_score: 80, soil_score: null, diversity_score: null, profitability_score: null };
  const basePriorities = { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 };

  // Condition 1: Normal (water 0.10, heat 0.10)
  const normWeights = ScoringEngine.calculateEffectiveWeights(basePriorities, 0.10, 0.10);
  assert.strictEqual(normWeights.effective_water_weight, 3.30);
  assert.strictEqual(normWeights.effective_heat_weight, 4.40);

  const normScoreA = ScoringEngine.calculateOverallScore(rotA, normWeights);
  const normScoreB = ScoringEngine.calculateOverallScore(rotB, normWeights);

  assert.strictEqual(normScoreA.weighted_sum, 440);
  assert.strictEqual(normScoreB.weighted_sum, 484);
  assert.strictEqual(normScoreB.weighted_sum > normScoreA.weighted_sum, true); // B wins

  // Condition 2: High Water Stress (water 0.90, heat 0.10)
  const highWeights = ScoringEngine.calculateEffectiveWeights(basePriorities, 0.90, 0.10);
  assert.strictEqual(highWeights.effective_water_weight, 5.70);
  assert.strictEqual(highWeights.effective_heat_weight, 4.40);

  const highScoreA = ScoringEngine.calculateOverallScore(rotA, highWeights);
  const highScoreB = ScoringEngine.calculateOverallScore(rotB, highWeights);

  assert.strictEqual(highScoreA.weighted_sum, 632);
  assert.strictEqual(highScoreB.weighted_sum, 580);
  assert.strictEqual(highScoreA.weighted_sum > highScoreB.weighted_sum, true); // A wins
  console.log('✓ Section 40 ranking-shift verified: Normal (A=440, B=484, B wins) -> High Water (A=632, B=580, A wins).\n');

  // Test 5: Missing Stress Behavior (Spec Section 41)
  console.log('[Test 5] Testing Missing Stress Behavior (null stresses -> 1.0x multiplier)...');
  const missingStressWeights = ScoringEngine.calculateEffectiveWeights(basePriorities, null, null);
  assert.strictEqual(missingStressWeights.water_multiplier, 1.0);
  assert.strictEqual(missingStressWeights.heat_multiplier, 1.0);
  assert.strictEqual(missingStressWeights.effective_water_weight, 3);
  assert.strictEqual(missingStressWeights.effective_heat_weight, 4);
  assert.notStrictEqual(missingStressWeights.water_warning, null);
  assert.notStrictEqual(missingStressWeights.heat_warning, null);
  console.log('✓ Section 41 verified: null stresses produce 1.0x multipliers and appropriate warning messages.\n');

  // Test 6: Missing Component Renormalization (Spec Section 36 & 38)
  console.log('[Test 6] Testing Missing Component Renormalization (Missing Profitability)...');
  const fullComponents = { water_score: 80, heat_score: 60, soil_score: 70, diversity_score: 65, profitability_score: 80 };
  const fullResult = ScoringEngine.calculateOverallScore(fullComponents, normWeights);
  assert.strictEqual(fullResult.available_components.length, 5);

  const missingProfitability = { water_score: 80, heat_score: 60, soil_score: 70, diversity_score: 65, profitability_score: null };
  const missingResult = ScoringEngine.calculateOverallScore(missingProfitability, normWeights);
  assert.strictEqual(missingResult.available_components.length, 4);
  assert.deepStrictEqual(missingResult.missing_components, ['profitability']);
  // Total weight drops by effective_profitability_weight (4)
  assert.strictEqual(missingResult.total_weight, normWeights.effective_water_weight + normWeights.effective_heat_weight + normWeights.effective_soil_weight + normWeights.effective_diversity_weight);
  console.log('✓ Section 36 verified: missing profitability component dropped from both numerator and denominator.\n');

  // Test 7: Real Demo Fields Database Seeding & Evaluation
  console.log('[Test 7] Seeding Full Database & Evaluating Real Demo Fields...');
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();
  await seedObservations();
  await seedBaselines();
  await seedFieldConditionScores();

  // Load crops and drainage matrix
  const cropsRes = await db.query('SELECT * FROM crops ORDER BY id');
  const crops = cropsRes.rows;
  const chickpea = crops.find(c => c.name.includes('Chickpea'));
  const mungbean = crops.find(c => c.name.includes('Mung Bean'));
  const wheat = crops.find(c => c.name.includes('Wheat'));
  const potato = crops.find(c => c.name.includes('Potato'));
  const boroRice = crops.find(c => c.name.includes('Boro Rice'));



  // Evaluate candidate rotation on Field 1 (Godagari Barind Terrace - Rainfed Drought)
  const f1Candidate = [chickpea, mungbean];
  const f1Rotation = await ScoringEngine.evaluateAndSaveRotation(db, {
    fieldId: 1,
    name: 'Godagari Pulse Sequence',
    seasonSequence: ['Rabi', 'Kharif-1'],
    candidateCrops: f1Candidate,
    cycleMode: 'continue_after_current',
    priorities: { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 }
  });

  assert.strictEqual(f1Rotation.field_id, 1);
  assert.strictEqual(f1Rotation.feasibility_status, 'Seasonally feasible');
  assert.strictEqual(Number(f1Rotation.adjusted_water_stress) > 0.90, true);
  assert.strictEqual(Number(f1Rotation.water_multiplier) > 1.90, true);
  assert.strictEqual(f1Rotation.observation_ids_used.length > 0, true);
  assert.strictEqual(f1Rotation.baseline_ids_used.length > 0, true);
  console.log(`✓ Field 1 evaluated & saved to DB: overall_score=${f1Rotation.overall_score}, water_multiplier=${f1Rotation.water_multiplier}x, water_weight=${f1Rotation.effective_water_weight}`);

  // Evaluate candidate rotation on Field 2 (Birol Piedmont Plain - Irrigated STW)
  const f2Candidate = [wheat, mungbean];
  const f2Rotation = await ScoringEngine.evaluateAndSaveRotation(db, {
    fieldId: 2,
    name: 'Birol Cereal-Pulse Sequence',
    seasonSequence: ['Rabi', 'Kharif-1'],
    candidateCrops: f2Candidate,
    cycleMode: 'continue_after_current',
    priorities: { water: 3, heat: 4, soil: 3, diversity: 3, profitability: 4 }
  });

  assert.strictEqual(f2Rotation.field_id, 2);
  assert.strictEqual(f2Rotation.feasibility_status, 'Seasonally feasible');
  assert.strictEqual(Number(f2Rotation.adjusted_water_stress) < 0.35, true);
  assert.strictEqual(Number(f2Rotation.water_multiplier) < 1.35, true);
  console.log(`✓ Field 2 evaluated & saved to DB: overall_score=${f2Rotation.overall_score}, water_multiplier=${f2Rotation.water_multiplier}x, water_weight=${f2Rotation.effective_water_weight}\n`);

  // Test 8: Full Structured Explanation Verification (Spec Section 49, 50, 42)
  console.log('[Test 8] Testing Spec Section 49 Structured Explanation Object...');
  const exp = f1Rotation.explanation;
  assert.strictEqual(typeof exp.water, 'object');
  assert.strictEqual(typeof exp.heat, 'object');
  assert.strictEqual(typeof exp.soil, 'object');
  assert.strictEqual(typeof exp.diversity, 'object');
  assert.deepStrictEqual(exp.diversity.candidate_crop_families, ['Legume', 'Legume']);
  assert.strictEqual(exp.diversity.repeat_check_sequence.length, 3);
  assert.strictEqual(exp.diversity.unique_family_ratio, 0.5);
  assert.strictEqual(typeof exp.profitability, 'object');
  assert.strictEqual(typeof exp.feasibility, 'object');
  assert.strictEqual(typeof exp.data_quality, 'object');
  assert.strictEqual(typeof exp.caveats, 'object');

  // Verify caveats presence (Spec Section 42)
  assert.strictEqual(exp.caveats.not_a_forecast.includes('Recent NASA conditions are used as a proxy'), true);
  assert.strictEqual(exp.caveats.flood_risk.includes('Flood-risk modeling is outside the current MVP'), true);

  // Verify terminology guardrail (Spec Section 50: never say "Best rotation")
  const expString = JSON.stringify(exp);
  assert.strictEqual(expString.includes('Best rotation'), false);
  console.log('✓ Section 49 explanation verified: all 8 required sub-objects present, caveats included, "Best rotation" strictly absent.\n');

  console.log('================================================================');
  console.log('ALL PHASE 10 & 11 ROTATION SCORING TESTS PASSED! (8/8)');
  console.log('================================================================');
}

if (require.main === module) {
  runScoringTests().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
}

module.exports = { runScoringTests };

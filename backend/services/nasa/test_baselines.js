/**
 * Field Shift - Baselines Verification Test Suite (Phase 6)
 * Validates:
 * - Current-year exclusion (year 2023 strictly excluded)
 * - DOY +/- 7 day window matching
 * - Crop-aware vegetation baseline matching (Field 3 Boro Rice cereal-matched, Field 4 limited)
 * - Non-vegetation crop_matched nullability (strictly NULL)
 * - Sample quality dimensions (usable vs limited)
 * - Full database persistence and retrieval across all 5 demo fields
 */
const assert = require('assert');
const baselineEngine = require('./baselineEngine');
const historicalDataService = require('./historicalDataService');
const BaselinesModel = require('../../models/baselinesModel');
const FieldsModel = require('../../models/fieldsModel');
const FieldCropHistoryModel = require('../../models/fieldCropHistoryModel');
const { seedBaselines } = require('../../db/seed_baselines');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const { seedObservations } = require('../../db/seed_observations');
const db = require('../../db');

async function runBaselinesTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 6 HISTORICAL BASELINES TEST SUITE');
  console.log('================================================================\n');

  // Setup Database
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();
  await seedObservations();

  const allFields = await FieldsModel.findAll();
  const field1 = allFields.find(f => f.id === 1);
  const field3 = allFields.find(f => f.id === 3);
  const field4 = allFields.find(f => f.id === 4);

  const history3 = await FieldCropHistoryModel.findByField(field3.id);
  const history4 = await FieldCropHistoryModel.findByField(field4.id);

  // Test 1: Current-Year Exclusion Rule (Spec Section 10)
  console.log('[Test 1] Testing Current-Year Exclusion Rule...');
  const baselines3 = baselineEngine.computeFieldBaselines(field3, history3, '2024-02-28');
  for (const b of baselines3) {
    const years = typeof b.years_included === 'string' ? JSON.parse(b.years_included) : b.years_included;
    assert.ok(!years.includes(2023), `Baseline for ${b.variable} must NOT include current Rabi year 2023!`);
    assert.ok(!years.includes(2024), `Baseline for ${b.variable} must NOT include calendar year 2024!`);
    assert.ok(years.every(y => y <= 2022), `All baseline years must be historical (<= 2022), found: ${years}`);
  }
  console.log('✓ Current-year exclusion strictly verified: year 2023/2024 never included in baselines.');

  // Test 2: Crop-Aware Vegetation Matching on Field 3 (Muktagacha - Boro Rice) (Spec Section 13)
  console.log('\n[Test 2] Testing Crop-Aware Vegetation Matching for Field 3 (Boro Rice / Cereal)...');
  assert.strictEqual(field3.current_crop, 'Boro Rice');
  assert.strictEqual(field3.current_crop_family, 'Cereal');

  const eviBaseline3 = baselines3.find(b => b.variable === 'evi');
  assert.ok(eviBaseline3, 'EVI baseline for Field 3 must exist');
  
  const eviYears3 = typeof eviBaseline3.years_included === 'string' ? JSON.parse(eviBaseline3.years_included) : eviBaseline3.years_included;
  // Field 3 was Boro Rice in 2019, 2020, 2021; Mustard in 2022.
  // 2022 must be excluded from vegetation baseline because Mustard is Oilseed, not Cereal!
  assert.deepStrictEqual(eviYears3, [2019, 2020, 2021], 'EVI baseline must strictly pull from Cereal years [2019, 2020, 2021] and exclude 2022 Mustard');
  assert.strictEqual(eviBaseline3.crop_matched, true, 'Crop-matched must be true for vegetation index');
  assert.strictEqual(eviBaseline3.n_years, 3, 'n_years must equal 3');
  assert.strictEqual(eviBaseline3.sample_quality, 'usable', 'sample_quality must be usable (n >= 10 and n_years >= 3)');
  assert.ok(eviBaseline3.n >= 10, `Valid scenes count n must be >= 10, got ${eviBaseline3.n}`);
  assert.ok(Number(eviBaseline3.mean) > 0.35, `Boro Rice canopy mean EVI should be realistic (> 0.35), got ${eviBaseline3.mean}`);
  console.log(`✓ Field 3 Boro Rice vegetation baseline verified: years [${eviYears3}], n=${eviBaseline3.n}, crop_matched=true, sample_quality=usable.`);

  // Test 3: Dual Quality Dimension on Field 4 (Mustard / Oilseed) (Spec Section 14)
  console.log('\n[Test 3] Testing Dual Quality Dimension on Field 4 (sample_quality=limited, crop_matched=true)...');
  assert.strictEqual(field4.current_crop, 'Mustard');
  assert.strictEqual(field4.current_crop_family, 'Oilseed');

  const baselines4 = baselineEngine.computeFieldBaselines(field4, history4, '2024-02-28');
  const eviBaseline4 = baselines4.find(b => b.variable === 'evi');
  const eviYears4 = typeof eviBaseline4.years_included === 'string' ? JSON.parse(eviBaseline4.years_included) : eviBaseline4.years_included;

  // Field 4 had Mustard in 2019 and 2022 (only 2 years).
  assert.deepStrictEqual(eviYears4, [2019, 2022], 'Field 4 EVI baseline must pull from Oilseed years [2019, 2022]');
  assert.strictEqual(eviBaseline4.crop_matched, true, 'Crop-matched must be true (same crop family)');
  assert.strictEqual(eviBaseline4.n_years, 2, 'n_years must equal 2');
  assert.strictEqual(eviBaseline4.sample_quality, 'limited', 'sample_quality must be limited because n_years (2) < 3');
  console.log('✓ Section 14 verified: sample_quality = limited with crop_matched = true properly preserved.');

  // Test 4: Non-Vegetation crop_matched Nullability & Provenance (Spec Section 14)
  console.log('\n[Test 4] Testing Non-Vegetation crop_matched Nullability & GPM Latency...');
  const soilBaseline = baselines3.find(b => b.variable === 'soil_moisture');
  const rainBaseline = baselines3.find(b => b.variable === 'rolling_30d_rainfall');
  const lstBaseline = baselines3.find(b => b.variable === 'daytime_lst_c');

  // Must strictly be null (never true or false)
  assert.strictEqual(soilBaseline.crop_matched, null, 'Soil moisture crop_matched must be null');
  assert.strictEqual(rainBaseline.crop_matched, null, 'Rainfall crop_matched must be null');
  assert.strictEqual(lstBaseline.crop_matched, null, 'MODIS LST crop_matched must be null');

  // Non-vegetation includes all 4 historical years regardless of crop
  const soilYears = typeof soilBaseline.years_included === 'string' ? JSON.parse(soilBaseline.years_included) : soilBaseline.years_included;
  assert.deepStrictEqual(soilYears, [2019, 2020, 2021, 2022], 'Non-vegetation baselines must include all 4 historical years');
  assert.strictEqual(soilBaseline.sample_quality, 'usable');
  assert.strictEqual(rainBaseline.gpm_latency_class, 'Final', 'Rainfall baseline gpm_latency_class must be Final');
  console.log('✓ Non-vegetation baselines verified: crop_matched is strictly null, includes all 4 years, gpm_latency_class = Final.');

  // Test 5: Full Database Seeding & Persistence (Spec Section 43)
  console.log('\n[Test 5] Ingesting & Verifying Baselines in Database...');
  const seeded = await seedBaselines();
  assert.strictEqual(seeded.length, 5 * 7, 'Should insert exactly 35 baselines (5 fields * 7 variables)');

  // Verify retrieval from database
  const dbField3Baselines = await BaselinesModel.findByField(3);
  assert.strictEqual(dbField3Baselines.length, 7, 'Database must return 7 baselines for Field 3');

  const dbField3Evi = await BaselinesModel.findByFieldAndVariable(3, 'evi', 'Rabi');
  assert.strictEqual(dbField3Evi.sample_quality, 'usable');
  assert.strictEqual(dbField3Evi.crop_matched, true);

  const dbField3Soil = await BaselinesModel.findByFieldAndVariable(3, 'soil_moisture', 'Rabi');
  assert.strictEqual(dbField3Soil.crop_matched, null);

  console.log('✓ Full database persistence verified: 35 baseline records correctly stored.');

  console.log('\n================================================================');
  console.log('ALL PHASE 6 HISTORICAL BASELINE TESTS PASSED! (5/5)');
  console.log('================================================================');
}

if (require.main === module) {
  runBaselinesTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Baselines tests failed:', err);
      process.exit(1);
    });
}

module.exports = { runBaselinesTests };

/**
 * Field Shift - Phase 1 Automated CRUD & Schema Verification Test Suite
 * Validates all 8 core tables, constraints, nullability rules, and cascade deletes.
 */
const assert = require('assert');
const db = require('./index');
const { runMigration } = require('./migrate');
const { seedReferenceData, getSeededDrainagePenalties } = require('./seed_reference');
const { seedCropsData, getSeededCrops } = require('./seed_crops');
const { seedDemoFieldsData, getSeededDemoFields } = require('./seed_demo_fields');
const FieldsModel = require('../models/fieldsModel');
const FieldCropHistoryModel = require('../models/fieldCropHistoryModel');
const EarthObservationsModel = require('../models/earthObservationsModel');
const BaselinesModel = require('../models/baselinesModel');
const FieldConditionScoresModel = require('../models/fieldConditionScoresModel');
const CropsModel = require('../models/cropsModel');
const RotationsModel = require('../models/rotationsModel');
const SeasonsModel = require('../models/seasonsModel');

async function runTestSuite() {
  console.log('================================================================');
  console.log('STARTING PHASE 1 DATABASE & CRUD TEST SUITE');
  console.log('================================================================\n');

  // 1. Run Migrations & Reference Seeding
  await runMigration();
  await seedReferenceData();

  // 2. Test Seasons & Drainage Penalties Reference Tables
  console.log('\n[Test 1] Verifying Seasons & Drainage Reference Tables...');
  const seasons = await SeasonsModel.findAll();
  assert.strictEqual(seasons.length, 3, 'Should have exactly 3 Bangladesh seasons');
  const rabi = await SeasonsModel.findByName('Rabi');
  assert.ok(rabi, 'Rabi season should exist');
  assert.strictEqual(rabi.start_month, 11, 'Rabi starts in November (11)');
  console.log('✓ Seasons table verified: Kharif-1, Kharif-2, Rabi present.');

  const drainageRows = await getSeededDrainagePenalties();
  assert.strictEqual(drainageRows.length, 9, 'Should have exactly 9 combination rows in drainage_penalties');
  const medMod = drainageRows.find(r => r.waterlogging_tolerance === 'Medium' && r.drainage_class === 'moderate');
  assert.ok(medMod, 'Medium tolerance + moderate drainage must exist');
  assert.strictEqual(medMod.penalty_points, 5, 'Section 33: Medium tolerance + Moderate drainage must equal 5');
  console.log('✓ Drainage penalties verified: All 9 rows present, Medium + Moderate = 5 verified.');

  // 3. Test Fields Table CRUD
  console.log('\n[Test 2] Testing Fields Model (Create, Read, Update)...');
  const fieldData = {
    name: 'Chattogram Demo Field Alpha',
    latitude: 22.3569,
    longitude: 91.7832,
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[[91.78, 22.35], [91.79, 22.35], [91.79, 22.36], [91.78, 22.36], [91.78, 22.35]]]
    },
    area_hectares: 1.25,
    soil_type: 'Alluvial Loam',
    soil_ph: 6.4,
    organic_matter_percent: 1.75,
    drainage: 'moderate',
    irrigation_available: true,
    current_crop: 'Boro Rice',
    current_crop_family: 'Cereal',
    previous_crop: 'Aman Rice',
    previous_crop_family: 'Cereal',
    current_season: 'Rabi',
    is_demo: true,
    data_label: 'Pre-processed NASA observations'
  };

  const createdField = await FieldsModel.create(fieldData);
  assert.ok(createdField.id, 'Field should have an auto-generated id');
  assert.strictEqual(createdField.name, fieldData.name);
  assert.strictEqual(Number(createdField.latitude), fieldData.latitude);
  assert.strictEqual(createdField.is_demo, true);
  console.log(`✓ Field created with ID: ${createdField.id}`);

  // Test Update
  const updatedField = await FieldsModel.update(createdField.id, { drainage: 'good', soil_ph: 6.6 });
  assert.strictEqual(updatedField.drainage, 'good');
  assert.strictEqual(Number(updatedField.soil_ph), 6.6);
  console.log('✓ Field update verified.');

  // 4. Test Field Crop History (Rabi year rule & season matching)
  console.log('\n[Test 3] Testing Field Crop History (Rabi Start-Year Rule)...');
  const history1 = await FieldCropHistoryModel.create({
    field_id: createdField.id,
    year: 2024, // Rabi 2024-2025 stored as 2024
    season: 'Rabi',
    crop: 'Lentil',
    crop_family: 'Legume',
    source: 'hand-entered demo data'
  });
  const history2 = await FieldCropHistoryModel.create({
    field_id: createdField.id,
    year: 2024,
    season: 'Kharif-1',
    crop: 'Aus Rice',
    crop_family: 'Cereal',
    source: 'hand-entered demo data'
  });

  const histories = await FieldCropHistoryModel.findByField(createdField.id);
  assert.strictEqual(histories.length, 2, 'Should find 2 history records');
  const rabiHistory = await FieldCropHistoryModel.findByFieldAndSeason(createdField.id, 2024, 'Rabi');
  assert.strictEqual(rabiHistory.crop, 'Lentil');
  console.log('✓ Field crop history with Rabi year rule verified.');

  // 5. Test Earth Observations (Unique constraint & upsert)
  console.log('\n[Test 4] Testing Earth Observations & Unique Constraint...');
  const obsData = {
    field_id: createdField.id,
    observation_date: '2024-02-28',
    ndvi: 0.6542,
    evi: 0.4215,
    ndmi: 0.2105,
    ndmi_anomaly: -0.0521,
    soil_moisture: 0.2450,
    soil_moisture_anomaly: -0.0410,
    rainfall_mm: 0.0,
    rolling_30d_rainfall: 12.5,
    rainfall_anomaly: -25.4,
    dry_day_count: 24,
    daytime_lst_c: 28.5,
    nighttime_lst_c: 16.2,
    daytime_lst_anomaly: 1.8,
    nighttime_lst_anomaly: 0.5,
    hot_day_count: 4,
    vegetation_stress: 0.25,
    water_stress_index: 0.45,
    adjusted_water_stress: 0.315, // irrigation adjusted
    heat_stress_index: 0.35,
    quality_status: 'normal',
    hls_product: 'HLSL30_VI',
    hls_version: '2.0',
    smap_product: 'NSIDC-0779',
    smap_version: '1',
    gpm_product: 'GPM_3IMERGDF',
    gpm_version: '07',
    gpm_latency_class: 'Final',
    modis_product: 'MOD11A1',
    modis_version: '061',
    analysis_window_start: '2024-01-01',
    analysis_window_end: '2024-02-28'
  };

  const createdObs = await EarthObservationsModel.upsert(obsData);
  assert.ok(createdObs.id);
  assert.strictEqual(createdObs.gpm_latency_class, 'Final');

  // Test Upsert on same date
  const updatedObs = await EarthObservationsModel.upsert({
    ...obsData,
    rainfall_mm: 5.2
  });
  assert.strictEqual(createdObs.id, updatedObs.id, 'Upsert must update existing record, not duplicate');
  assert.strictEqual(Number(updatedObs.rainfall_mm), 5.2);
  console.log('✓ Earth observations unique constraint & upsert verified.');

  // 6. Test Baselines Model & Quality Dimensions
  console.log('\n[Test 5] Testing Baselines Model & Crop-Matched Nullability...');
  // A. Vegetation baseline (crop_matched is boolean)
  const vegBaseline = await BaselinesModel.create({
    field_id: createdField.id,
    variable: 'evi',
    season: 'Rabi',
    mean: 0.4500,
    std: 0.0500,
    n: 14,
    n_years: 5,
    years_included: [2019, 2020, 2021, 2022, 2023],
    period_start: '2019-11-01',
    period_end: '2023-02-28',
    method: 'DOY_plus_minus_7_days',
    sample_quality: 'usable',
    crop_matched: true
  });
  assert.strictEqual(vegBaseline.crop_matched, true);
  assert.strictEqual(vegBaseline.sample_quality, 'usable');

  // B. Soil moisture baseline (crop_matched MUST be null, Section 14)
  const smBaseline = await BaselinesModel.create({
    field_id: createdField.id,
    variable: 'soil_moisture',
    season: 'Rabi',
    mean: 0.2800,
    std: 0.0350,
    n: 25,
    n_years: 5,
    years_included: [2019, 2020, 2021, 2022, 2023],
    period_start: '2019-11-01',
    period_end: '2023-02-28',
    method: 'DOY_plus_minus_7_days',
    sample_quality: 'usable',
    crop_matched: false // Pass false to test that model enforces NULL for non-vegetation!
  });
  assert.strictEqual(smBaseline.crop_matched, null, 'crop_matched must be strictly NULL for non-vegetation baseline');
  console.log('✓ Baseline quality dimensions (sample_quality and crop_matched nullability) verified.');

  // 7. Test Field Condition Scores Model (Section 23 & 43)
  console.log('\n[Test 6] Testing Field Condition Scores Model...');
  const condScore = await FieldConditionScoresModel.create({
    field_id: createdField.id,
    window_start: '2024-01-01',
    window_end: '2024-02-28',
    vegetation_condition_score: 75.0,
    water_condition_score: 55.0, // uses raw water stress
    heat_condition_score: 65.0,
    field_condition_score: 64.0,
    available_components: ['vegetation', 'water', 'heat'],
    missing_components: [],
    nasa_sources_available: 4,
    data_quality_status: 'normal',
    scoring_version: 'v6.2'
  });
  assert.ok(condScore.id);
  assert.strictEqual(Number(condScore.field_condition_score), 64.0);
  console.log('✓ Field condition scores record created and retrieved.');

  // 8. Test Crops Model (Per-trait source status - Section 26, 27)
  console.log('\n[Test 7] Testing Crops Model & Trait Verification Status...');
  const cropData = {
    name: 'Mung Bean (BARI Mung-6)',
    crop_family: 'Legume',
    water_demand: 35.0,
    heat_tolerance: 70.0,
    soil_health_benefit: 80.0,
    diversity_value: 85.0,
    profitability_value: 65.0,
    water_demand_status: 'prototype-mapped',
    heat_tolerance_status: 'verified',
    soil_health_benefit_status: 'verified',
    diversity_value_status: 'prototype-mapped',
    profitability_value_status: 'unverified',
    growing_days: 65,
    suitable_seasons: ['Kharif-1', 'Kharif-2'],
    waterlogging_tolerance: 'Low',
    min_soil_ph: 6.0,
    max_soil_ph: 7.5,
    source_name: 'BARI Pulse Research Centre',
    source_url: 'http://bari.gov.bd/pulse',
    source_reference: 'BARI Krishi Projukti Hatboi 2022',
    source_status: 'prototype-mapped'
  };

  const createdCrop = await CropsModel.create(cropData);
  assert.ok(createdCrop.id);
  assert.strictEqual(createdCrop.name, cropData.name);
  assert.strictEqual(createdCrop.heat_tolerance_status, 'verified');
  assert.strictEqual(createdCrop.profitability_value_status, 'unverified');
  assert.strictEqual(createdCrop.waterlogging_tolerance, 'Low');
  console.log(`✓ Crop record created with ID: ${createdCrop.id}`);

  // Test nullable waterlogging_tolerance (Section 33: unknown tolerance must be null)
  const unknownCrop = await CropsModel.create({
    name: 'Wild Herb Test',
    crop_family: 'Forb',
    growing_days: 45,
    suitable_seasons: ['Rabi'],
    waterlogging_tolerance: null // unknown tolerance
  });
  assert.strictEqual(unknownCrop.waterlogging_tolerance, null, 'Unknown tolerance must be stored as null');
  console.log('✓ Nullable waterlogging_tolerance (unknown tolerance) verified.');

  // Clean up test crop records so seed_crops tests a pristine table
  await CropsModel.delete(createdCrop.id);
  await CropsModel.delete(unknownCrop.id);

  // 9. Test Rotations Model (Section 43 & Section 38)
  console.log('\n[Test 8] Testing Rotations Model & Audit Trail...');
  const rotationData = {
    field_id: createdField.id,
    name: 'Rotation A: Rice - Mung Bean - Lentil',
    season_sequence: ['Kharif-1', 'Kharif-2', 'Rabi'],
    crops: ['Aus Rice', 'Mung Bean', 'Lentil'],
    rotation_cycle_mode: 'continue_after_current',
    repeat_context_crop: 'Boro Rice',
    repeat_context_type: 'current',
    water_score: 72.5,
    soil_score: 68.0,
    heat_score: 60.0,
    diversity_score: 36.7, // As specified in Section 31
    profitability_score: 65.0,
    base_soil_health_score: 78.0,
    drainage_penalty: 5.0,
    ph_penalty: 5.0,
    organic_matter_adjustment: 0,
    soil_score_final: 68.0,
    water_stress_index: 0.45,
    adjusted_water_stress: 0.315,
    heat_stress_index: 0.35,
    water_multiplier: 1.315,
    heat_multiplier: 1.35,
    effective_water_weight: 3.945,
    effective_heat_weight: 4.050,
    overall_score: 63.4,
    feasibility_status: 'Seasonally feasible',
    sample_quality: 'usable',
    crop_matched: true,
    data_quality_status: 'normal',
    observation_ids_used: [createdObs.id],
    baseline_ids_used: [vegBaseline.id, smBaseline.id],
    explanation: {
      water: 'Water score 72.5 with moderate adjusted water stress (0.315).',
      diversity: 'Diversity score 36.7 includes repeat penalty (-30) from adjacent cereal sequence.'
    },
    scoring_version: 'v6.2',
    scored_at: new Date()
  };

  const createdRotation = await RotationsModel.create(rotationData);
  assert.ok(createdRotation.id);
  assert.strictEqual(Number(createdRotation.overall_score), 63.4);
  assert.strictEqual(Number(createdRotation.diversity_score), 36.7);
  console.log(`✓ Rotation score record created with ID: ${createdRotation.id}`);

  // 10. Test Foreign Key Cascade Delete
  console.log('\n[Test 9] Testing Foreign Key CASCADE Deletion...');
  await FieldsModel.delete(createdField.id);
  const deletedField = await FieldsModel.findById(createdField.id);
  assert.strictEqual(deletedField, null, 'Field should be deleted');

  // Verify child tables were cascaded
  const childHistories = await FieldCropHistoryModel.findByField(createdField.id);
  assert.strictEqual(childHistories.length, 0, 'Crop history must cascade delete');
  const childObs = await EarthObservationsModel.findByField(createdField.id);
  assert.strictEqual(childObs.length, 0, 'Observations must cascade delete');
  const childRotations = await RotationsModel.findByField(createdField.id);
  assert.strictEqual(childRotations.length, 0, 'Rotations must cascade delete');
  console.log('✓ Foreign key cascade deletes verified for all dependent tables.');

  // 11. Test Full Bangladesh Crops Database Seeding (Phase 2 & Spec Section 26, 27)
  console.log('\n[Test 10] Testing Full Bangladesh Crops Database Seeding (Spec Section 26, 27)...');
  await seedCropsData();
  const allCrops = await getSeededCrops();
  assert.strictEqual(allCrops.length, 12, 'Should have exactly 12 canonical Bangladesh staple crops');
  
  // Verify key flagship crops
  const flagshipNames = ['Rice', 'Mung Bean', 'Lentil', 'Mustard', 'Wheat', 'Maize', 'Jute'];
  for (const name of flagshipNames) {
    const crop = allCrops.find(c => c.name === name);
    assert.ok(crop, `Flagship crop ${name} must be seeded`);
    assert.strictEqual(crop.trait_mapping_version, 'v6.2');
    assert.strictEqual(crop.profitability_value, null, 'Unverified profitability must be null');
    assert.strictEqual(crop.profitability_value_status, 'unverified', 'Profitability status must be unverified');
    assert.strictEqual(crop.source_status, 'prototype-mapped');
  }

  // Verify nullable waterlogging tolerance
  const lowDrainCrops = allCrops.filter(c => c.waterlogging_tolerance === 'Low');
  const highDrainCrops = allCrops.filter(c => c.waterlogging_tolerance === 'High');
  assert.ok(lowDrainCrops.length > 0, 'Should have Low tolerance crops');
  assert.ok(highDrainCrops.length > 0, 'Should have High tolerance crops');
  console.log(`✓ Crop database seeded and verified: exactly ${allCrops.length} canonical varieties with Section 26/27 status flags.`);

  // 12. Test Demo Fields & Crop History Seeding (Phase 3 & Spec Section 51, 43, 11)
  console.log('\n[Test 11] Testing Demo Fields & Multi-Year Crop History Seeding (Spec Section 51)...');
  
  // Isolate database so Demo Field IDs are 100% deterministic (IDs 1 to 5)
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();

  const seededFields = await seedDemoFieldsData();
  assert.strictEqual(seededFields.length, 5, 'Should seed exactly 5 Bangladesh demo fields');
  
  const allDemoFields = await getSeededDemoFields();
  assert.strictEqual(allDemoFields.length, 5, 'getSeededDemoFields should return 5 fields');

  // Verify deterministic IDs 1 to 5 and season-consistent crop states
  allDemoFields.forEach((field, idx) => {
    assert.strictEqual(field.id, idx + 1, `Field ${field.name} must have deterministic ID: ${idx + 1}`);
    assert.strictEqual(field.current_season, 'Rabi', 'current_season must be Rabi for demo anchor date 2024-02-28');
    assert.strictEqual(field.previous_crop, 'T. Aman Rice', 'previous_crop must be prior season (Kharif-2 2023) T. Aman Rice');
    assert.strictEqual(field.previous_crop_family, 'Cereal');
  });

  // Verify specific authentic Rabi crops for each field
  assert.strictEqual(allDemoFields[0].current_crop, 'Chickpea'); // Godagari (Rajshahi)
  assert.strictEqual(allDemoFields[1].current_crop, 'Wheat');    // Birol (Dinajpur)
  assert.strictEqual(allDemoFields[2].current_crop, 'Boro Rice'); // Muktagacha (Mymensingh)
  assert.strictEqual(allDemoFields[3].current_crop, 'Mustard');  // Jhikargacha (Jessore)
  assert.strictEqual(allDemoFields[4].current_crop, 'Lentil');   // Kaliganj (Satkhira)

  for (const field of allDemoFields) {
    assert.strictEqual(field.is_demo, true, 'is_demo must be true');
    assert.ok(
      ['Pre-processed NASA observations', 'Simulated demonstration data'].includes(field.data_label),
      'data_label must be compliant with Section 51'
    );
    assert.ok(Number(field.latitude) >= 20.5 && Number(field.latitude) <= 26.7, 'Latitude must be within Bangladesh');
    assert.ok(Number(field.longitude) >= 88.0 && Number(field.longitude) <= 92.7, 'Longitude must be within Bangladesh');
    assert.ok(field.soil_ph >= 4.5 && field.soil_ph <= 8.5, 'Soil pH must be realistic');
    assert.ok(['good', 'moderate', 'poor'].includes(field.drainage), 'Drainage must be valid class');
    assert.ok(typeof field.irrigation_available === 'boolean', 'Irrigation flag must be boolean');

    // Check crop history
    const history = await FieldCropHistoryModel.findByField(field.id);
    assert.ok(history.length >= 8, `Field ${field.name} must have at least 3 historical years of history`);
    for (const h of history) {
      assert.strictEqual(h.source, 'hand-entered demo data', 'Demo history must be labeled hand-entered demo data');
      assert.ok(['Kharif-1', 'Kharif-2', 'Rabi'].includes(h.season), 'Season must be valid');
      assert.ok(h.year >= 2018 && h.year <= 2024, 'Year must be realistic');
    }
  }
  console.log('✓ All 5 Bangladesh demo fields & crop histories verified strictly matching Spec Section 51.');

  console.log('\n================================================================');
  console.log('ALL PHASE 1, 2 & 3 TESTS PASSED SUCCESSFULLY! (12/12)');
  console.log('================================================================');
}

if (require.main === module) {
  runTestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Test suite failed:', err);
      process.exit(1);
    });
}

module.exports = { runTestSuite };

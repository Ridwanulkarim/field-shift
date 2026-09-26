/**
 * Field Shift - NASA Preprocessing Verification Test Suite (Phase 5)
 * Validates QA filtering, HLS 30d -> 60d fallback, GPM 90d rolling rainfall,
 * MODIS LST conversion (0.02 scale), SMAP 9km transparency, and database ingestion.
 */
const assert = require('assert');
const preprocessingService = require('./preprocessingService');
const { seedObservations, ANALYSIS_START, ANALYSIS_END, LEAD_IN_START } = require('../../db/seed_observations');
const db = require('../../db');
const { runMigration } = require('../../db/migrate');
const { seedReferenceData } = require('../../db/seed_reference');
const { seedCropsData } = require('../../db/seed_crops');
const { seedDemoFieldsData } = require('../../db/seed_demo_fields');
const EarthObservationsModel = require('../../models/earthObservationsModel');

async function runPreprocessingTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 5 NASA PREPROCESSING TEST SUITE');
  console.log('================================================================\n');

  // Test 1: HLS QA Filtering & 30d -> 60d Adaptive Fallback (Spec Section 8 & 9)
  console.log('[Test 1] Testing HLS QA Filtering & 30d -> 60d Fallback Logic...');
  
  // Scenario A: >= 3 valid scenes in 30d -> use 30d window
  const obsScenarioA = [
    { date: '2024-02-20', ndvi: 0.65, evi: 0.40, ndmi: 0.20, qa: 0 },
    { date: '2024-02-15', ndvi: 0.62, evi: 0.38, ndmi: 0.18, qa: 0 },
    { date: '2024-02-05', ndvi: 0.58, evi: 0.35, ndmi: 0.15, qa: 0 },
    { date: '2024-01-10', ndvi: 0.52, evi: 0.30, ndmi: 0.12, qa: 0 } // outside 30d
  ];
  const evalA = preprocessingService.filterAndEvaluateHls(obsScenarioA, '2024-02-28');
  assert.strictEqual(evalA.windowUsed, 30, 'Scenario A should use 30d window');
  assert.strictEqual(evalA.count, 3);
  assert.strictEqual(evalA.qualityStatus, 'usable');

  // Scenario B: < 3 valid scenes in 30d, but >= 5 in 60d -> trigger 60d fallback
  const obsScenarioB = [
    { date: '2024-02-20', ndvi: 0.65, evi: 0.40, ndmi: 0.20, qa: 0 }, // 30d
    { date: '2024-02-15', ndvi: 0.62, evi: 0.38, ndmi: 0.18, qa: 0b00000010 }, // cloudy in 30d!
    { date: '2024-02-05', ndvi: 0.58, evi: 0.35, ndmi: 0.15, qa: 0 }, // 30d (only 2 valid in 30d)
    { date: '2024-01-20', ndvi: 0.54, evi: 0.32, ndmi: 0.14, qa: 0 }, // 60d
    { date: '2024-01-15', ndvi: 0.53, evi: 0.31, ndmi: 0.13, qa: 0 }, // 60d
    { date: '2024-01-05', ndvi: 0.50, evi: 0.29, ndmi: 0.11, qa: 0 }  // 60d (total 5 valid in 60d)
  ];
  const evalB = preprocessingService.filterAndEvaluateHls(obsScenarioB, '2024-02-28');
  assert.strictEqual(evalB.windowUsed, 60, 'Scenario B should trigger 60d fallback');
  assert.strictEqual(evalB.count, 5);
  assert.strictEqual(evalB.qualityStatus, 'usable');

  // Scenario C: < 5 valid scenes in 60d -> insufficient observations
  const obsScenarioC = [
    { date: '2024-02-20', ndvi: 0.65, evi: 0.40, ndmi: 0.20, qa: 0 },
    { date: '2024-01-15', ndvi: 0.53, evi: 0.31, ndmi: 0.13, qa: 0 }
  ];
  const evalC = preprocessingService.filterAndEvaluateHls(obsScenarioC, '2024-02-28');
  assert.strictEqual(evalC.windowUsed, null);
  assert.strictEqual(evalC.qualityStatus, 'insufficient_observations');

  console.log('✓ HLS QA filtering and adaptive 30d -> 60d fallback verified.');

  // Test 2: GPM 90-Day Rolling 30d Rainfall & Consecutive Dry Days (Spec Section 18 & 19)
  console.log('\n[Test 2] Testing GPM Rolling 30-Day Rainfall & Dry Day Calculation...');
  
  // Synthetic daily series: 90 days. Day 1 to 50: 0.0 mm. Day 51: 10.0 mm. Day 52 to 90: 0.0 mm.
  const testRainfallSeries = [];
  const baseDate = new Date('2023-11-30');
  for (let i = 0; i < 90; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    let rain = 0.0;
    if (i === 30) rain = 25.0; // Day 30 has 25 mm rain
    if (i === 60) rain = 0.5;  // Trace rain (< 1.0 mm, should not break dry streak)
    testRainfallSeries.push({ date: dateStr, rainfall_mm: rain });
  }

  const rollingResults = preprocessingService.calculateRollingRainfall(
    testRainfallSeries,
    '2023-12-30',
    '2024-02-27'
  );

  const day30Date = testRainfallSeries[30].date;
  const day30Data = rollingResults.get(day30Date);
  assert.strictEqual(day30Data.rolling_30d_rainfall, 25.0, 'Rolling sum at day 30 should be 25.0');
  assert.strictEqual(day30Data.dry_day_count, 0, 'Rain >= 1.0 mm must reset dry day count to 0');

  // Day 59 (29 days after Day 30) should still include Day 30's rain
  const day59Date = testRainfallSeries[59].date;
  const day59Data = rollingResults.get(day59Date);
  assert.strictEqual(day59Data.rolling_30d_rainfall, 25.0, 'Day 59 is within 30-day window of Day 30 rain');
  assert.strictEqual(day59Data.dry_day_count, 29, '29 consecutive dry days since Day 30');

  // Day 60 has 0.5 mm rain (trace < 1.0 mm). Dry day count should continue to increment!
  const day60Date = testRainfallSeries[60].date;
  const day60Data = rollingResults.get(day60Date);
  assert.strictEqual(day60Data.dry_day_count, 30, 'Trace rain < 1.0mm does not break dry streak');

  // Day 61 (31 days after Day 30) should no longer include Day 30's rain
  const day61Date = testRainfallSeries[61].date;
  const day61Data = rollingResults.get(day61Date);
  assert.strictEqual(day61Data.rolling_30d_rainfall, 0.5, 'Day 30 rain has rolled out of 30-day window');

  console.log('✓ GPM 30-day rolling rainfall and dry-day count mathematics verified.');

  // Test 3: MODIS LST Scale Factor & Kelvin-to-Celsius Conversion (Spec Section 3.4)
  console.log('\n[Test 3] Testing MODIS LST Scale Factor (0.02) and Celsius Conversion...');
  
  // 300 Kelvin = 26.85 Celsius -> DN = 300 / 0.02 = 15000
  const c1 = preprocessingService.convertModisLst(15000, 0);
  assert.strictEqual(c1, 26.85, '15000 DN should equal 26.85 C');

  // 290 Kelvin = 16.85 Celsius -> DN = 290 / 0.02 = 14500
  const c2 = preprocessingService.convertModisLst(14500, 0);
  assert.strictEqual(c2, 16.85, '14500 DN should equal 16.85 C');

  // Cloud-masked QC (QC_Day bits 0-1 = 10 -> LST not produced due to cloud)
  const cCloud = preprocessingService.convertModisLst(15000, 0b00000010);
  assert.strictEqual(cCloud, null, 'Cloud-affected LST observation must be null');

  console.log('✓ MODIS LST scale factor (0.02), Kelvin-to-Celsius conversion, and QC filtering verified.');

  // Test 4: SMAP Soil Moisture Extraction & Transparency (Spec Section 3.2 & 4)
  console.log('\n[Test 4] Testing SMAP Soil Moisture Extraction & 9 km Provenance...');
  
  const smGood = preprocessingService.extractSoilMoisture(0.24567, 0);
  assert.strictEqual(smGood, 0.2457, 'Valid soil moisture rounded to 4 decimals');

  const smBad = preprocessingService.extractSoilMoisture(0.24567, 1);
  assert.strictEqual(smBad, null, 'Failed retrieval quality flag must return null');

  console.log('✓ SMAP soil moisture extraction and quality filtering verified.');

  // Test 5: Full Database Ingestion & Verification for 5 Demo Fields
  console.log('\n[Test 5] Ingesting & Verifying Pre-processed Observations in Database...');
  
  // Fresh migration and seeds
  await db.resetDb();
  await runMigration();
  await seedReferenceData();
  await seedCropsData();
  await seedDemoFieldsData();

  const totalInserted = await seedObservations();
  assert.strictEqual(totalInserted, 5 * 61, 'Should insert 305 total daily observations (5 fields * 61 days)');

  // Verify records for Field 1
  const field1Obs = await EarthObservationsModel.findByField(1, ANALYSIS_START, ANALYSIS_END);
  assert.strictEqual(field1Obs.length, 61, 'Field 1 should have exactly 61 observation rows');

  const latestObs = await EarthObservationsModel.findLatestByField(1);
  const obsDateStr = (latestObs.observation_date instanceof Date ? latestObs.observation_date.toISOString() : String(latestObs.observation_date)).split('T')[0];
  assert.strictEqual(obsDateStr, '2024-02-28', 'Latest observation must match DEMO_ANCHOR_DATE');
  assert.strictEqual(latestObs.smap_product, 'SPL3SMP_E', 'SMAP product must explicitly be SPL3SMP_E (zero silent substitution)');
  assert.strictEqual(latestObs.smap_version, '006');
  assert.strictEqual(latestObs.gpm_product, 'GPM_3IMERGDF');
  assert.strictEqual(latestObs.gpm_version, '07');
  assert.strictEqual(latestObs.gpm_latency_class, 'Final');
  assert.strictEqual(latestObs.modis_product, 'MOD11A1.061 / MYD11A1.061');
  assert.strictEqual(latestObs.modis_version, '061');
  const winStartStr = (latestObs.analysis_window_start instanceof Date ? latestObs.analysis_window_start.toISOString() : String(latestObs.analysis_window_start)).split('T')[0];
  const winEndStr = (latestObs.analysis_window_end instanceof Date ? latestObs.analysis_window_end.toISOString() : String(latestObs.analysis_window_end)).split('T')[0];
  assert.strictEqual(winStartStr, '2023-12-30');
  assert.strictEqual(winEndStr, '2024-02-28');
  assert.ok(latestObs.rolling_30d_rainfall != null, 'Rolling 30d rainfall must be populated');
  assert.ok(latestObs.dry_day_count != null, 'Dry day count must be populated');
  assert.ok(latestObs.daytime_lst_c != null, 'Daytime LST must be populated');

  // Verify data_sources JSONB contains 9km disclosure
  const dataSources = typeof latestObs.data_sources === 'string' ? JSON.parse(latestObs.data_sources) : latestObs.data_sources;
  assert.strictEqual(dataSources.smap.product, 'SPL3SMP_E.006');
  assert.strictEqual(dataSources.smap.resolution_km, 9);
  assert.ok(dataSources.smap.disclosure.includes('9km soil moisture'));

  // Test Upsert Idempotency (re-inserting same date should update without throwing constraint error)
  const upserted = await EarthObservationsModel.upsert({
    field_id: 1,
    observation_date: '2024-02-28',
    daytime_lst_c: 29.15,
    quality_status: 'usable'
  });
  assert.strictEqual(Number(upserted.daytime_lst_c), 29.15, 'Upsert must update record seamlessly');

  console.log('✓ Database ingestion verified: 305 records stored with complete provenance and transparent 9 km disclosure.');

  console.log('\n================================================================');
  console.log('ALL PHASE 5 NASA PREPROCESSING TESTS PASSED! (5/5)');
  console.log('================================================================');
}

if (require.main === module) {
  runPreprocessingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Preprocessing tests failed:', err);
      process.exit(1);
    });
}

module.exports = { runPreprocessingTests };

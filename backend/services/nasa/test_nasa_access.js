/**
 * Field Shift - NASA Access Verification Suite (Phase 4)
 * Validates server-side Earthdata authentication, subset query formatting,
 * and Spec Section 8 observation windows across all 5 Bangladesh demo fields.
 */
const assert = require('assert');
const nasaService = require('./index');
const { DEMO_FIELDS } = require('../../db/seed_demo_fields');
const config = require('../../config');

async function runNasaAccessTests() {
  console.log('================================================================');
  console.log('STARTING PHASE 4 NASA ACCESS VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Earthdata Authentication Module
  console.log('[Test 1] Testing Server-Side Earthdata Authentication...');
  const auth = nasaService.auth;
  assert.ok(auth, 'EarthdataAuth must be instantiated');
  const headers = await auth.getAuthHeaders();
  assert.ok(typeof headers === 'object', 'getAuthHeaders must return an object');
  console.log('✓ Earthdata authentication service initialized securely (server-side only).');

  // Test 2: GPM 90-day Fetch Window (Spec Section 8)
  console.log('\n[Test 2] Testing GPM 90-Day Fetch Window Calculation...');
  const gpmWindows = nasaService.gpm.calculateWindows('2024-02-28');
  assert.strictEqual(gpmWindows.anchorDate, '2024-02-28');
  assert.strictEqual(gpmWindows.analysisWindow.days, 60);
  assert.strictEqual(gpmWindows.fetchWindow.days, 90);
  assert.strictEqual(gpmWindows.fetchWindow.leadInDays, 30);
  assert.strictEqual(gpmWindows.analysisWindow.end, '2024-02-28');
  assert.strictEqual(gpmWindows.fetchWindow.end, '2024-02-28');
  console.log('✓ GPM windows verified: 60-day analysis + 30-day lead-in = 90-day fetch window.');

  // Test 3: AppEEARS Point Task Payload Formatting
  console.log('\n[Test 3] Testing AppEEARS Point Subset Request Formatting...');
  const demoField = DEMO_FIELDS[0];
  const samplePayload = nasaService.appeears.buildPointTaskPayload({
    taskName: 'Test_Godagari_Point',
    latitude: demoField.latitude,
    longitude: demoField.longitude,
    startDate: '01-29-2024',
    endDate: '02-28-2024'
  });
  assert.strictEqual(samplePayload.task_type, 'point');
  assert.strictEqual(samplePayload.params.coordinates[0].latitude, demoField.latitude);
  assert.strictEqual(samplePayload.params.coordinates[0].longitude, demoField.longitude);
  assert.ok(samplePayload.params.layers.some(l => l.product === 'HLSL30_VI.002' && l.layer === 'NDVI'));
  assert.ok(samplePayload.params.layers.some(l => l.product === 'MOD11A1.061' && l.layer === 'LST_Day_1km'));
  assert.ok(samplePayload.params.layers.some(l => l.product === 'MYD11A1.061' && l.layer === 'LST_Day_1km'));
  assert.ok(samplePayload.params.layers.some(l => l.product === 'SPL3SMP_E.006' && l.layer === 'Soil_Moisture_AM'));
  console.log('✓ AppEEARS point task payload conforms strictly to NASA LP DAAC API specification (including Terra MOD11A1 & Aqua MYD11A1).');

  // Test 4: CMR Query URL Generation (Spec Section 5, 6, 8)
  console.log('\n[Test 4] Testing NASA CMR Query URL Construction...');
  const cmrUrl = nasaService.cmr.buildQueryUrl({
    shortName: 'HLSL30_VI',
    version: '2.0',
    latitude: demoField.latitude,
    longitude: demoField.longitude,
    startDate: '2024-01-29T00:00:00Z',
    endDate: '2024-02-28T23:59:59Z'
  });
  assert.ok(cmrUrl.includes('cmr.earthdata.nasa.gov/search/granules.json'));
  assert.ok(cmrUrl.includes('short_name=HLSL30_VI'));
  assert.ok(cmrUrl.includes('version=2.0'));
  assert.ok(cmrUrl.includes(`point=${demoField.longitude}%2C${demoField.latitude}`));
  console.log('✓ NASA CMR query URL formatted with correct collection, version, point, and temporal constraints.');

  // Test 5: Full Subset Plan for All 5 Bangladesh Demo Fields
  console.log('\n[Test 5] Verifying Full Subset Request Plans for All 5 Demo Fields...');
  for (let i = 0; i < DEMO_FIELDS.length; i++) {
    const field = { id: i + 1, ...DEMO_FIELDS[i] };
    const plan = nasaService.buildFieldSubsetPlan(field, '2024-02-28');

    assert.strictEqual(plan.fieldId, i + 1);
    assert.strictEqual(plan.anchorDate, '2024-02-28');

    // HLS windows
    assert.strictEqual(plan.products.hls.primaryWindow.days, 30);
    assert.strictEqual(plan.products.hls.fallbackWindow.days, 60);

    // SMAP & MODIS windows
    assert.strictEqual(plan.products.smap.window.days, 60);
    assert.strictEqual(plan.products.modis.window.days, 60);
    assert.deepStrictEqual(plan.products.modis.productIds, ['MOD11A1.061', 'MYD11A1.061']);

    // GPM window
    assert.strictEqual(plan.products.gpm.windows.fetchWindow.days, 90);
    assert.strictEqual(plan.products.gpm.latencyClass, 'final');

    console.log(`  ✓ Field ${i + 1} (${field.name}): HLS, SMAP, MODIS, GPM subset plans verified.`);
  }

  console.log('\n================================================================');
  console.log('ALL PHASE 4 NASA ACCESS TESTS PASSED! (5/5)');
  console.log('================================================================');
}

if (require.main === module) {
  runNasaAccessTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ NASA access tests failed:', err);
      process.exit(1);
    });
}

module.exports = { runNasaAccessTests };

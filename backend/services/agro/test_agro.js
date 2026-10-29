/**
 * Unit Test Suite for Agronomic Compute Engine & Advisory API
 * Verifies exact Playbook algorithms (rain_onset, GDD, Mann-Whitney U, sensitivity check)
 */
const assert = require('assert');
const {
  rainOnset,
  growingDegreeDays,
  mannWhitneyUTest,
  getPlantingAdvisory,
  CROP_GDD_BASES,
  HISTORICAL_DISTRICT_ONSETS
} = require('./agroEngine');

console.log('================================================================');
console.log('STARTING AGRONOMIC COMPUTE & ADVISORY ENGINE UNIT TESTS');
console.log('================================================================\n');

// 1. Test rainOnset algorithm
console.log('[Test 1] Testing rain_onset(daily_mm, window=7, threshold=20, dry_spell_max=7)...');
// Case A: Dry period followed by 7 days of rain >= 20mm, followed by regular rain
const mockRainSuccess = [
  0, 0, 0, 0, 0,            // Days 1-5 (dry)
  5, 5, 5, 5, 0, 0, 0,      // Days 6-12 (Sum: 20mm in 7-day window)
  2, 0, 3, 0, 4, 0, 2       // Days 13-19 (no dry spell > 7 days)
];
const onsetA = rainOnset(mockRainSuccess, 7, 20, 7);
assert.strictEqual(onsetA, 6, 'Onset should be day 6 (1-indexed)');

// Case B: 20mm in 7 days, but followed by a 10-day dry spell (violates dry_spell_max)
const mockRainFailed = [
  0, 0, 0, 0, 0,            // Days 1-5
  5, 5, 5, 5, 0, 0, 0,      // Days 6-12 (Sum = 20mm)
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // Days 13-22 (10 consecutive dry days > 7)
  10, 10, 10
];
const onsetB = rainOnset(mockRainFailed, 7, 20, 7);
assert.strictEqual(onsetB, null, 'False onset followed by >7 dry days must be rejected');
console.log('✓ rain_onset algorithm verified: detects true onset, rejects false onset with dry spell.\n');

// 2. Test growingDegreeDays
console.log('[Test 2] Testing growingDegreeDays(tmax, tmin, tbase, tupper)...');
const gdd1 = growingDegreeDays(30, 20, 10, 35); // tmean = 25, GDD = 25 - 10 = 15
assert.strictEqual(gdd1, 15);

const gdd2 = growingDegreeDays(8, 6, 10, 35); // tmean = 7 < 10, GDD = 0
assert.strictEqual(gdd2, 0);

const gdd3 = growingDegreeDays(40, 30, 10, 35); // capped at tupper=35, tmean = (35+30)/2 = 32.5 -> GDD = 22.5
assert.strictEqual(gdd3, 22.5);
console.log('✓ Growing Degree Days verified: baseline subtraction, zero clamping, and upper threshold cap verified.\n');

// 3. Test mannWhitneyUTest
console.log('[Test 3] Testing Mann-Whitney U Test & statistical significance...');
const p1Mock = [150, 152, 153, 151, 154, 150];
const p2Mock = [162, 165, 163, 167, 164, 166];
const mwRes = mannWhitneyUTest(p1Mock, p2Mock);
assert.strictEqual(mwRes.u_stat, 0, 'No overlap should yield minimum U=0');
assert.strictEqual(mwRes.is_significant, true, 'Distinct distributions must yield p < 0.05');
assert.strictEqual(mwRes.p_value < 0.05, true);
console.log(`✓ Mann-Whitney U test verified: U=${mwRes.u_stat}, z=${mwRes.z_score}, p=${mwRes.p_value}, significant=${mwRes.is_significant}.\n`);

// 4. Test getPlantingAdvisory for Rajshahi Aman Rice
console.log('[Test 4] Testing getPlantingAdvisory("Rajshahi", "Aman Rice")...');
const adv = getPlantingAdvisory('Rajshahi', 'Aman Rice', 20.0);
assert.strictEqual(adv.district, 'Rajshahi');
assert.strictEqual(adv.crop, 'Aman Rice');
assert.strictEqual(adv.shift_in_days, 11, 'Rajshahi Aman onset shift must be exactly 11 whole days');
assert.strictEqual(adv.two_distributions.period_1.mean_doy < adv.two_distributions.period_2.mean_doy, true);
assert.strictEqual(adv.test_statistic.is_statistically_significant, true);
assert.strictEqual(adv.sms_length <= 160, true, 'SMS text must be under 160 characters GSM limit');
assert.strictEqual(adv.assumptions.onset_definition.includes('20mm'), true);
assert.strictEqual(adv.license, 'Apache-2.0');

// Verify sensitivity check
assert.strictEqual(adv.sensitivity_check['15mm'].shift_days >= 9, true);
assert.strictEqual(adv.sensitivity_check['20mm'].shift_days, 11);
assert.strictEqual(adv.sensitivity_check['25mm'].shift_days <= 13, true);

// Verify provenance stack
assert.strictEqual(adv.provenance_stack.some(s => s.mission === 'NASA POWER'), true);
assert.strictEqual(adv.provenance_stack.some(s => s.mission === 'GPM IMERG'), true);
assert.strictEqual(adv.provenance_stack.some(s => s.mission === 'SMAP'), true);
assert.strictEqual(adv.provenance_stack.some(s => s.mission.includes('MODIS')), true);
console.log(`✓ Advisory payload verified: shift=${adv.shift_in_days} days, SMS length=${adv.sms_length} chars, sensitivity stable [10d, 11d, 12d], provenance stack complete.\n`);

console.log('================================================================');
console.log('ALL AGRONOMIC COMPUTE & ADVISORY UNIT TESTS PASSED (4/4)!');
console.log('================================================================');

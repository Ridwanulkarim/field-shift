// Unit tests for the field profile (monthly climatology, per-crop evidence) and the summary sentence.
// Inputs are hand-built fixtures with answers computed by hand. None of these numbers is a NASA value.

import { describe, it, expect } from 'vitest';
import { monthlyClimatology, cropFieldEvidence } from '../src/science/fieldProfile.js';
import { buildFieldSummary } from '../src/science/fieldSummary.js';
import { buildSeries } from './helpers/series.js';

// 2 mm of rain every day in July and August, none otherwise; 30 C maximum, 20 C minimum.
const wetJulAug = (overrides = () => ({})) =>
  buildSeries(2001, 2003, (y, m, d) => ({ precipMm: m === 7 || m === 8 ? 2 : 0, tMaxC: 30, tMinC: 20, ...overrides(y, m, d) }));

const CROP = {
  slug: 'test-crop', nameEn: 'Test crop', nameBn: 'পরীক্ষা', startMonth: 7, endMonth: 8,
  waterNeedMmMin: 100, waterNeedMmMax: 200, heatThresholdC: 35, salinityTolerance: 2,
};

describe('monthlyClimatology', () => {
  it('returns twelve months with hand-checked means (July: 31 days x 2 mm = 62 mm)', () => {
    const m = monthlyClimatology(wetJulAug());
    expect(m).toHaveLength(12);
    expect(m[6].rainMm).toEqual({ mean: 62, median: 62, years: 3 });
    expect(m[7].rainMm.mean).toBe(62);
    expect(m[6].tMaxC).toEqual({ mean: 30, years: 3 });
    expect(m[6].tMinC).toEqual({ mean: 20, years: 3 });
  });
  it('treats an observed dry month as 0 mm, which is different from missing', () => {
    expect(monthlyClimatology(wetJulAug())[1].rainMm).toEqual({ mean: 0, median: 0, years: 3 }); // February
  });
  it('drops a year whose rain coverage is below 98 percent instead of counting the gaps as zero', () => {
    // July 2002 loses 2 of 31 days (93.5 percent observed): that year is left out, the other two stay.
    const series = wetJulAug((y, m, d) => (y === 2002 && m === 7 && d <= 2 ? { precipMm: null } : {}));
    expect(monthlyClimatology(series)[6].rainMm).toEqual({ mean: 62, median: 62, years: 2 });
  });
  it('still uses a temperature month with 28 of 31 days observed (90.3 percent, above the 90 percent minimum)', () => {
    const series = wetJulAug((y, m, d) => (y === 2002 && m === 8 && d <= 3 ? { tMaxC: null } : {}));
    expect(monthlyClimatology(series)[7].tMaxC).toEqual({ mean: 30, years: 3 });
  });
  it('reports null, not zero, for a month with no usable year', () => {
    const series = wetJulAug((y, m) => (m === 7 ? { precipMm: null, tMaxC: null, tMinC: null } : {}));
    const july = monthlyClimatology(series)[6];
    expect(july.rainMm).toEqual({ mean: null, median: null, years: 0 });
    expect(july.tMaxC.mean).toBeNull();
  });
  it('handles an empty series', () => {
    expect(monthlyClimatology([]).every((m) => m.rainMm.mean === null && m.rainMm.years === 0)).toBe(true);
  });
});

describe('cropFieldEvidence', () => {
  it('computes season rain (62 + 62 = 124 mm), shortfall against the assumed need, and zero heat exposure', () => {
    const e = cropFieldEvidence(wetJulAug(), CROP, { salinityClass: 'none' });
    expect(e.seasonRain.meanMm).toBe(124);
    expect(e.seasonRain.years).toBe(3);
    expect(e.seasonRain.waterNeedMm).toEqual({ min: 100, max: 200 });
    expect(e.seasonRain.shortfallMm).toEqual({ atMinNeed: 0, atMaxNeed: 76 });
    expect(e.heat).toMatchObject({ thresholdC: 35, meanShareOfDaysAtOrAbove: 0 });
    expect(e.salinity).toEqual({ fieldClass: 'none', cropTolerance: 2, compatibility: 'within_tolerance' });
    expect(e.flags).toEqual([]);
    expect(e.traitBasis).toBe('UNVERIFIED_GENERAL_KNOWLEDGE');
  });
  it('flags salinity above the crop tolerance (moderate = level 3 > tolerance 2)', () => {
    const e = cropFieldEvidence(wetJulAug(), CROP, { salinityClass: 'moderate' });
    expect(e.salinity.compatibility).toBe('exceeds_tolerance');
    expect(e.flags).toContain('salinity_exceeds_tolerance');
  });
  it('says salinity was not entered instead of guessing', () => {
    const e = cropFieldEvidence(wetJulAug(), CROP, { salinityClass: null });
    expect(e.salinity.compatibility).toBe('unknown');
    expect(e.flags).toContain('salinity_not_entered');
  });
  it('counts hot days: 35 C on every day of the crop months gives a heat share of 1', () => {
    const series = wetJulAug(() => ({ tMaxC: 35 }));
    expect(cropFieldEvidence(series, CROP, { salinityClass: null }).heat.meanShareOfDaysAtOrAbove).toBe(1);
  });
  it('reports insufficient data with null values and flags, never zero', () => {
    const series = wetJulAug(() => ({ precipMm: null, tMaxC: null }));
    const e = cropFieldEvidence(series, CROP, { salinityClass: null });
    expect(e.seasonRain.meanMm).toBeNull();
    expect(e.seasonRain.shortfallMm).toBeNull();
    expect(e.flags).toEqual(expect.arrayContaining(['rain_data_insufficient', 'heat_data_insufficient']));
  });
  it('uses the crop basis it is given', () => {
    expect(cropFieldEvidence(wetJulAug(), { ...CROP, basis: 'BRRI_TABLE_3' }, null).traitBasis).toBe('BRRI_TABLE_3');
  });
});

describe('buildFieldSummary', () => {
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, rainMm: { mean: i === 6 ? 300 : i === 0 ? 5 : 100, median: 0, years: 20 } }));
  const crop = (nameEn, atMinNeed, compatibility = 'within_tolerance') => ({
    nameEn, seasonRain: { shortfallMm: { atMinNeed, atMaxNeed: atMinNeed } }, salinity: { compatibility },
  });
  const args = (over = {}) => ({
    monthly, crops: [crop('Boro rice', 40), crop('Aman rice', 0)], cell: { approxAreaKm2: 3500 }, areaHa: 1.2,
    soil: { salinityClass: null, salinityDsM: null }, spansMultipleCells: false, ...over,
  });

  it('names the wettest and driest months from the numbers it is given', () => {
    const s = buildFieldSummary(args());
    expect(s).toContain('July is the wettest month on average (300 mm)');
    expect(s).toContain('January the driest (5 mm)');
  });
  it('lists only crops whose season rain is below the assumed minimum need, and says the values are unverified', () => {
    const s = buildFieldSummary(args());
    expect(s).toContain('for 1 of 2 crops: Boro rice.');
    expect(s).not.toContain('Aman rice.');
    expect(s).toMatch(/unverified/);
  });
  it('says soil fit was not checked when salinity is missing', () => {
    expect(buildFieldSummary(args())).toContain('No soil salinity was entered, so soil fit was not checked.');
  });
  it('names crops above the entered salinity, and says when none are', () => {
    const bad = buildFieldSummary(args({ crops: [crop('Aman rice', 0, 'exceeds_tolerance')], soil: { salinityClass: 'moderate', salinityDsM: 5 } }));
    expect(bad).toContain('(5 dS/m, class "moderate") is above the tolerance assumed for: Aman rice.');
    const ok = buildFieldSummary(args({ soil: { salinityClass: 'none', salinityDsM: 1 } }));
    expect(ok).toContain('within the tolerance assumed for every crop');
  });
  it('truncates a long crop list, mentions a cell-edge crossing, and always ends with the forecast caveat', () => {
    const many = Array.from({ length: 9 }, (_, i) => crop(`Crop ${i + 1}`, 10));
    const s = buildFieldSummary(args({ crops: many, spansMultipleCells: true }));
    expect(s).toContain('Crop 6 and 3 more');
    expect(s).toContain('crosses a grid-cell edge');
    expect(s).toMatch(/not a forecast\. Check with your local agricultural extension officer/);
  });
  it('handles a cell with no rainfall data and omits the field size when unknown', () => {
    const empty = monthly.map((m) => ({ ...m, rainMm: { mean: null, median: null, years: 0 } }));
    const s = buildFieldSummary(args({ monthly: empty, areaHa: null }));
    expect(s).toContain('not enough rainfall data');
    expect(s).not.toContain('the field is');
  });
});

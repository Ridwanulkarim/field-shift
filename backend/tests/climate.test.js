import { describe, it, expect } from 'vitest';
import {
  yearlyRainTotal,
  yearlyHeatDays,
  yearlyHeatFraction,
  yearlyLongestDrySpell,
  yearlyMonsoonOnset,
  climateIndicators,
  cropClimate,
  seriesCoverage,
} from '../src/science/climate.js';
import { buildSeries, flat } from './helpers/series.js';

describe('yearlyRainTotal', () => {
  it('sums rain over a window with a hand-checkable answer', () => {
    // 2 mm every day: June(30)+July(31)+Aug(31)+Sep(30) = 122 days -> 244 mm
    const s = buildSeries(2001, 2003, flat(2, 30));
    const out = yearlyRainTotal(s, 6, 9);
    expect(out).toHaveLength(3);
    expect(out.every((p) => p.value === 244)).toBe(true);
  });

  it('puts January and February in the cycle that began the previous November', () => {
    const s = buildSeries(2001, 2003, (y, m) => ({ precipMm: m === 1 ? 10 : 0, tMaxC: 25 }));
    const out = yearlyRainTotal(s, 11, 3);
    // Cycles starting 2001 and 2002 are complete (they end Mar 2002 / Mar 2003); 2000 is incomplete.
    expect(out.map((p) => p.year)).toEqual([2001, 2002]);
    expect(out[0].value).toBe(310); // 31 January days x 10 mm
  });

  it('leaves out incomplete years instead of reporting a misleadingly small total', () => {
    const s = buildSeries(2001, 2002, flat(1, 30)).filter((r) => r.date >= '2001-08-01');
    const out = yearlyRainTotal(s, 6, 9);
    expect(out.map((p) => p.year)).toEqual([2002]);
  });

  it('does not treat missing days as zero rain: too many gaps drops the year', () => {
    const s = buildSeries(2001, 2002, (y, m, d) => ({
      precipMm: y === 2001 && m >= 6 && m <= 9 && d <= 15 ? null : 1,
      tMaxC: 30,
    }));
    const out = yearlyRainTotal(s, 6, 9);
    expect(out.map((p) => p.year)).toEqual([2002]);
  });
});

describe('heat indicators', () => {
  it('counts days at or above the threshold (boundary included)', () => {
    // March-May: 35 C on exactly the first 10 days of each March, 34.9 otherwise
    const s = buildSeries(2001, 2002, (y, m, d) => ({ precipMm: 0, tMaxC: m === 3 && d <= 10 ? 35 : 34.9 }));
    const out = yearlyHeatDays(s, 3, 5, 35);
    expect(out.map((p) => p.value)).toEqual([10, 10]);
  });
  it('reports the share of days above threshold', () => {
    const s = buildSeries(2001, 2001, (y, m) => ({ precipMm: 0, tMaxC: m === 4 ? 36 : 25 }));
    const out = yearlyHeatFraction(s, 3, 5, 35);
    expect(out[0].value).toBeCloseTo(30 / 92, 10); // April 30 of Mar+Apr+May = 92 days
  });
});

describe('yearlyLongestDrySpell', () => {
  it('finds the longest run of days under 1 mm', () => {
    const s = buildSeries(2001, 2002, (y, m, d) => ({
      // Nov 2001: rain on day 1 and day 20, so dry runs are 18 days (2-19) and 10 days (21-30)
      precipMm: y === 2001 && m === 11 && (d === 1 || d === 20) ? 5 : y === 2001 && m === 11 ? 0 : 0,
      tMaxC: 25,
    }));
    const out = yearlyLongestDrySpell(s, 11, 3);
    const first = out.find((p) => p.year === 2001);
    // After 20 Nov it stays dry through Dec, Jan, Feb, Mar: that is the longest run.
    // 10 (Nov 21-30) + 31 + 31 + 28 + 31 = 131
    expect(first.value).toBe(131);
  });
});

describe('yearlyMonsoonOnset', () => {
  it('finds the first day whose 7-day total reaches 50 mm', () => {
    // 10 mm per day from 20 June onwards: first 7-day window >= 50 mm starts 15 June if
    // rain starts then. Rain 10 mm/day from 15 June: window 15-21 June = 70 mm; but the
    // window starting 11 June includes 15-17 June = 30 mm only, so first >=50 is 12 June
    // (12..18 June has 4 rain days = 40)... compute: window starting d has rain on days
    // max(d,15)..d+6, count = d+6-15+1 = d-8 days when d<15. Need 5 days -> d = 13.
    const s = buildSeries(2001, 2002, (y, m, d) => ({
      precipMm: m === 6 && d >= 15 ? 10 : 0,
      tMaxC: 30,
    }));
    const out = yearlyMonsoonOnset(s);
    expect(out).toHaveLength(2);
    // 13 June 2001 is day 164 (non-leap): Jan31+Feb28+Mar31+Apr30+May31 = 151, +13 = 164
    expect(out[0].value).toBe(164);
  });
  it('returns no value for a year without any qualifying rain', () => {
    const s = buildSeries(2001, 2001, flat(0, 30));
    expect(yearlyMonsoonOnset(s)).toEqual([]);
  });
});

describe('climateIndicators and cropClimate', () => {
  const s = buildSeries(2001, 2015, flat(3, 33));

  it('returns the five indicators with trends', () => {
    const ind = climateIndicators(s);
    expect(ind.map((i) => i.id)).toEqual(['monsoonRain', 'rabiRain', 'monsoonOnset', 'preMonsoonHeatDays', 'rabiDrySpell']);
    const monsoon = ind.find((i) => i.id === 'monsoonRain');
    expect(monsoon.trend.mean).toBe(366);
    expect(monsoon.trend.verdict).toBe('not_distinguishable_from_noise');
  });

  it('averages rain and heat exposure inside a crop window', () => {
    const crop = { startMonth: 7, endMonth: 11, heatThresholdC: 32 };
    const cc = cropClimate(s, crop);
    expect(cc.rainMm).toBe(3 * 153); // Jul31+Aug31+Sep30+Oct31+Nov30 = 153 days
    expect(cc.heatFraction).toBe(1); // 33 C is above the 32 C threshold every day
    expect(cc.rainYears).toBe(15);
  });

  it('describes coverage including missing days', () => {
    const withGap = [{ date: '2001-01-01', precipMm: null, tMaxC: 30, tMinC: 20 }, { date: '2001-01-02', precipMm: 1, tMaxC: 31, tMinC: 21 }];
    const cov = seriesCoverage(withGap);
    expect(cov.days).toBe(2);
    expect(cov.missing.precipMm).toBe(1);
    expect(cov.firstDate).toBe('2001-01-01');
  });

  it('copes with an empty series', () => {
    expect(climateIndicators([]).every((i) => i.trend.verdict === 'insufficient_data')).toBe(true);
    expect(cropClimate([], { startMonth: 7, endMonth: 11, heatThresholdC: 35 }).rainMm).toBeNull();
  });
});

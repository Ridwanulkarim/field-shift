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

// ---------------------------------------------------------------------------------------
// Phase 0: calendar-gap safety. Rows that are ABSENT (not null) must never be treated as
// adjacent days. Fixtures are hand-built, not NASA data.
// ---------------------------------------------------------------------------------------
import { monsoonOnsetByYear } from '../src/science/climate.js';
import { analyzeOnsetShift } from '../src/science/onsetAnalysis.js';

function mayToAugust(year, fn, absent = []) {
  const out = [];
  for (let t = Date.UTC(year, 4, 1); t <= Date.UTC(year, 7, 31); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (absent.includes(date)) continue;
    out.push({ date, precipMm: fn(date), tMaxC: 30, tMinC: 22 });
  }
  return out;
}
const range = (from, to) => {
  const out = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

describe('onset with absent date rows', () => {
  it('does not stitch seven rows spanning 15 calendar days into one window', () => {
    const wet = ['2010-05-08', '2010-05-09', '2010-05-18', '2010-05-19', '2010-05-20', '2010-05-21', '2010-05-22'];
    const s = mayToAugust(2010, (d) => (wet.includes(d) ? 8 : 0.5), range('2010-05-10', '2010-05-17'));
    const [y] = monsoonOnsetByYear(s);
    // 56 mm falls inside 15 calendar days, never inside 7. Windows touching the gap are
    // unobserved, so the year cannot be called 'no_onset' either: it is 'unknown'.
    expect(y.status).toBe('unknown');
    expect(y.value).toBeNull();
    expect(yearlyMonsoonOnset(s)).toEqual([]);
  });

  it('finds the same onset with and without an irrelevant gap later in the season', () => {
    const full = mayToAugust(2010, (d) => (d >= '2010-06-10' ? 10 : 0));
    const gapLater = mayToAugust(2010, (d) => (d >= '2010-06-10' ? 10 : 0), range('2010-08-01', '2010-08-05'));
    expect(yearlyMonsoonOnset(full)).toEqual(yearlyMonsoonOnset(gapLater));
    // 10 mm/day from 10 June: the window starting 8 June holds 5 wet days (50 mm). 8 June = day 159.
    expect(yearlyMonsoonOnset(full)[0].value).toBe(159);
  });

  it('reports no_onset (not unknown) when every window was fully observed and none qualified', () => {
    expect(monsoonOnsetByYear(mayToAugust(2010, () => 1))[0].status).toBe('no_onset');
  });

  it('flags a year whose earlier windows were unobserved before a qualifying window', () => {
    const s = mayToAugust(2010, (d) => (d >= '2010-06-20' ? 10 : 0), ['2010-06-01']);
    const [y] = monsoonOnsetByYear(s);
    expect(y.status).toBe('onset');
    expect(y.earlierWindowsUnobserved).toBe(true);
    expect(yearlyMonsoonOnset(s)).toEqual([]); // excluded from yearly values
  });

  it('gives the same onset value for the same weather in a leap and a non-leap year', () => {
    const wetFrom = (y) => (d) => (d >= `${y}-06-10` ? 10 : 0);
    const a = yearlyMonsoonOnset(mayToAugust(2011, wetFrom(2011)))[0].value;
    const b = yearlyMonsoonOnset(mayToAugust(2012, wetFrom(2012)))[0].value;
    expect(a).toBe(b);
  });
});

describe('dry spell with absent date rows', () => {
  function season(absent = [], wetDay = null) {
    const out = [];
    for (let t = Date.UTC(2010, 10, 1); t <= Date.UTC(2011, 2, 31); t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (absent.includes(date)) continue;
      out.push({ date, precipMm: date === wetDay ? 30 : 0, tMaxC: 25, tMinC: 15 });
    }
    return out;
  }
  it('does not hide a wet day inside a gap (reported run must not exceed the true run)', () => {
    // True longest dry run: 1 Nov..12 Dec = 42 days or 14 Dec..31 Mar = 108 days.
    const s = season(range('2010-12-12', '2010-12-20'), '2010-12-13');
    const [y] = yearlyLongestDrySpell(s, 11, 3);
    // 9 unknown days out of 151 (6%): the year is kept, but the uncertainty is explicit.
    expect(y === undefined || y.value <= 108).toBe(true);
  });
  it('drops a year whose unknown days could change the answer by more than the tolerance', () => {
    const s = season(range('2010-12-12', '2010-12-20'), '2010-12-13');
    const out = yearlyLongestDrySpell(s, 11, 3);
    expect(out).toEqual([]); // longestPossible - longestKnown is far above 7 days
  });
  it('reports lower and upper bounds when a few days are null', () => {
    const s = season([]);
    s[3].precipMm = null; // 4 Nov: known run is 4 Nov+1..31 Mar = 147, possible run is the whole 151
    const [y] = yearlyLongestDrySpell(s, 11, 3);
    expect(y.unknownDays).toBe(1);
    expect(y.longestPossible).toBe(151);
    expect(y.value).toBe(147);
    expect(y.value).toBeLessThan(y.longestPossible);
  });
});

describe('rain totals with partial coverage', () => {
  it('leaves out a year with about 10% of days missing instead of reporting a ~10% smaller total', () => {
    const s = buildSeries(2001, 2001, (y, m, d) => ({ precipMm: m === 6 && d <= 12 ? null : 10, tMaxC: 30 }));
    // 12 of 122 days (9.8%) missing
    expect(yearlyRainTotal(s, 6, 9)).toEqual([]);
  });
  it('reports observed and expected day counts for a kept year', () => {
    const s = buildSeries(2001, 2001, (y, m, d) => ({ precipMm: m === 6 && d === 1 ? null : 10, tMaxC: 30 }));
    const [p] = yearlyRainTotal(s, 6, 9);
    expect(p.observedDays).toBe(121);
    expect(p.expectedDays).toBe(122);
  });
});

describe('seriesCoverage absent dates', () => {
  it('counts calendar dates that have no row', () => {
    const cov = seriesCoverage([
      { date: '2001-01-01', precipMm: 1, tMaxC: 30, tMinC: 20 },
      { date: '2001-01-05', precipMm: 1, tMaxC: 30, tMinC: 20 },
    ]);
    expect(cov.expectedDays).toBe(5);
    expect(cov.absentDays).toBe(3);
  });
});

describe('onset shift with censored years', () => {
  it('keeps a no_onset year in the late period instead of dropping it', () => {
    const yearly = Array.from({ length: 12 }, (_, i) => ({ year: 2000 + i, value: 150 + (i % 2) }));
    yearly[10] = { year: 2010, status: 'no_onset' };
    yearly[11] = { year: 2011, status: 'no_onset' };
    const r = analyzeOnsetShift(yearly, { splitYear: 2006 });
    expect(r.censoredYears).toBe(2);
    expect(r.lateYears).toBe(6);
    expect(r.excludedYears).toBe(0);
  });
  it('excludes and counts unknown years', () => {
    const yearly = [
      ...Array.from({ length: 6 }, (_, i) => ({ year: 2000 + i, value: 150 })),
      { year: 2006, status: 'unknown' },
      ...Array.from({ length: 5 }, (_, i) => ({ year: 2007 + i, value: 160 })),
    ];
    const r = analyzeOnsetShift(yearly, { splitYear: 2006 });
    expect(r.excludedYears).toBe(1);
    expect(r.lateYears).toBe(5);
  });
});

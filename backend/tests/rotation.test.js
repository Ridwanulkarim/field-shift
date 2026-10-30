import { describe, it, expect } from 'vitest';
import { CROPS } from '../src/data/reference/crops.js';
import { cropClimate } from '../src/science/climate.js';
import {
  checkFeasible,
  generateCandidates,
  scoreRotation,
  evaluateRotations,
  rotationKey,
  orderForDisplay,
} from '../src/science/rotation.js';
import { buildSeries } from './helpers/series.js';

const crop = (slug) => CROPS.find((c) => c.slug === slug);
const crops = (...slugs) => slugs.map(crop);

// Fixture climate: wet monsoon (Jun-Oct 10 mm/day), almost dry otherwise, mild temperatures.
// Hand-built, NOT NASA data.
const drySeries = buildSeries(2001, 2020, (y, m) => ({
  precipMm: m >= 6 && m <= 10 ? 10 : 0.1,
  tMaxC: 29,
}));

function makeCtx({ series = drySeries, soil, irrigation = 'limited', priorities } = {}) {
  const cropClimateMap = {};
  if (series) for (const c of CROPS) cropClimateMap[c.slug] = cropClimate(series, c);
  return {
    cropClimate: cropClimateMap,
    soil: { salinity: 'none', drainage: 'good', ...soil },
    irrigation,
    priorities: { waterSaving: 1, heatResilience: 1, soilHealth: 1, diversification: 1, lowInput: 1, ...priorities },
  };
}

describe('feasibility', () => {
  it('rejects crops that share more than one month in the field', () => {
    expect(checkFeasible(crops('boro', 'aus')).ok).toBe(false); // Apr-May overlap
    expect(checkFeasible(crops('boro', 'mustard')).ok).toBe(false);
  });
  it('accepts the classic double-rice and triple patterns', () => {
    expect(checkFeasible(crops('aman', 'boro')).ok).toBe(true);
    expect(checkFeasible(crops('aman', 'mustard', 'mungbean')).ok).toBe(true);
  });
});

describe('generateCandidates', () => {
  const all = generateCandidates(CROPS);
  it('only yields 2-3 crop sets that are all feasible', () => {
    expect(all.length).toBeGreaterThan(5);
    for (const set of all) {
      expect(set.length).toBeGreaterThanOrEqual(2);
      expect(set.length).toBeLessThanOrEqual(3);
      expect(checkFeasible(set).ok).toBe(true);
    }
  });
  it('contains no duplicates', () => {
    const keys = all.map(rotationKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('includes Aman -> Mustard -> Mungbean and excludes Boro + Mustard', () => {
    const keys = all.map(rotationKey);
    expect(keys).toContain('aman+mungbean+mustard');
    expect(keys.some((k) => k.includes('boro') && k.includes('mustard'))).toBe(false);
  });
  it('orders display labels starting from the Aman season', () => {
    expect(orderForDisplay(crops('mungbean', 'aman', 'mustard')).map((c) => c.slug)).toEqual(['aman', 'mustard', 'mungbean']);
  });
});

describe('scoreRotation', () => {
  it('lowers the soil fit when the soil is more saline than the crop tolerates', () => {
    const fresh = scoreRotation(crops('aman', 'lentil'), makeCtx({ soil: { salinity: 'none' } }));
    const saline = scoreRotation(crops('aman', 'lentil'), makeCtx({ soil: { salinity: 'high' } }));
    const soil = (s) => s.components.find((c) => c.id === 'soilFit').value;
    expect(soil(saline)).toBeLessThan(soil(fresh));
    expect(saline.score).toBeLessThan(fresh.score);
  });

  it('gives a legume rotation a higher soil-health component than a cereal-only one', () => {
    const withLegume = scoreRotation(crops('aman', 'lentil'), makeCtx());
    const cereals = scoreRotation(crops('aman', 'boro'), makeCtx());
    const sh = (s) => s.components.find((c) => c.id === 'soilHealth').value;
    expect(sh(withLegume)).toBe(1); // legume + two different families
    expect(sh(cereals)).toBe(0); // same family, no legume
  });

  it('scores Boro as more water-dependent than Mustard in a dry-season-dry climate', () => {
    const boro = scoreRotation(crops('boro'), makeCtx({ irrigation: 'none' }));
    const mustard = scoreRotation(crops('mustard'), makeCtx({ irrigation: 'none' }));
    const wf = (s) => s.components.find((c) => c.id === 'waterFit').value;
    expect(wf(boro)).toBeLessThan(wf(mustard));
  });

  it('reliable irrigation softens the water penalty', () => {
    const none = scoreRotation(crops('boro'), makeCtx({ irrigation: 'none' }));
    const reliable = scoreRotation(crops('boro'), makeCtx({ irrigation: 'reliable' }));
    const wf = (s) => s.components.find((c) => c.id === 'waterFit').value;
    expect(wf(reliable)).toBeGreaterThan(wf(none));
  });

  it('leaves climate components out (not guessed) when no climate data exists', () => {
    const r = scoreRotation(crops('aman', 'mustard'), makeCtx({ series: null }));
    const get = (id) => r.components.find((c) => c.id === id);
    expect(get('waterFit').value).toBeNull();
    expect(get('heatFit').value).toBeNull();
    expect(get('waterSaving').value).toBeNull();
    expect(typeof r.score).toBe('number');
  });

  it('a priority of 0 removes that component from the weighted average', () => {
    const r = scoreRotation(crops('aman', 'lentil'), makeCtx({ priorities: { lowInput: 0 } }));
    expect(r.components.find((c) => c.id === 'lowInput').weight).toBe(0);
  });

  it('keeps the score between 0 and 100', () => {
    for (const set of generateCandidates(CROPS)) {
      const s = scoreRotation(set, makeCtx({ soil: { salinity: 'high', drainage: 'poor' } })).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

describe('evaluateRotations', () => {
  const run = (overrides) =>
    evaluateRotations({ crops: CROPS, existingSlugs: ['boro', 'aman'], ctx: makeCtx(overrides) });

  it('returns the existing rotation first plus three ranked alternatives', () => {
    const { strategies } = run();
    expect(strategies).toHaveLength(4);
    expect(strategies[0].kind).toBe('existing');
    expect(strategies[0].id).toBe('aman+boro');
    const alts = strategies.slice(1);
    expect(alts.map((a) => a.rank)).toEqual([1, 2, 3]);
    expect(alts.every((a) => a.id !== 'aman+boro')).toBe(true);
    const scores = alts.map((a) => a.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('gives every strategy the explanation fields the challenge asks for', () => {
    for (const s of run().strategies) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(Array.isArray(s.benefits)).toBe(true);
      expect(Array.isArray(s.risks)).toBe(true);
      expect(s.informationGaps.length).toBeGreaterThan(0);
      expect(s.evidence.length).toBe(s.crops.length);
      expect(s.evidence[0].cropParameterBasis).toBe('UNVERIFIED_GENERAL_KNOWLEDGE');
      expect(s.summary.length).toBeGreaterThan(0);
    }
  });

  it('compares each alternative with the existing rotation', () => {
    const alt = run().strategies[1];
    expect(alt.comparison).toHaveProperty('scoreDifference');
    expect(Array.isArray(alt.comparison.improvements)).toBe(true);
  });

  it('states a drop in cropping intensity as a trade-off instead of hiding it', () => {
    // Existing double rice keeps the plot in crop ~11 months; Aman + Mungbean uses far fewer.
    const { strategies } = run();
    const sparse = strategies.slice(1).find((s) => s.monthsInField <= strategies[0].monthsInField - 2);
    if (sparse) {
      expect(sparse.comparison.tradeOffs.join(' ')).toMatch(/cropping intensity/);
      // The separate "left unused" risk is tied to an absolute limit (7 months or fewer in the field),
      // not to the size of the drop; the relative drop is always stated as a trade-off above.
      if (sparse.monthsInField <= 7) expect(sparse.risks.join(' ')).toMatch(/unused|only about/);
    }
    const veryShort = strategies.find((s) => s.monthsInField <= 7);
    if (veryShort) expect(veryShort.risks.join(' ')).toMatch(/only about/);
    const aman = scoreRotation(crops('aman', 'mungbean'), makeCtx());
    expect(aman.score).toBeGreaterThan(0);
  });

  it('works for a single-crop existing rotation', () => {
    const r = evaluateRotations({ crops: CROPS, existingSlugs: ['boro'], ctx: makeCtx() });
    expect(r.strategies[0].crops).toHaveLength(1);
    expect(r.strategies[0].risks.join(' ')).toMatch(/single crop/i);
    expect(r.strategies).toHaveLength(4);
  });

  it('is deterministic', () => {
    expect(run()).toEqual(run());
  });

  it('states the data gap when climate is unavailable', () => {
    const { strategies } = run({ series: null });
    for (const s of strategies) {
      expect(s.informationGaps.join(' ')).toMatch(/No climate data is loaded/);
    }
  });

  it('shifts the ranking when the user cares most about saving irrigation water', () => {
    const base = run({ priorities: { waterSaving: 0 } });
    const thirsty = run({ priorities: { waterSaving: 3 } });
    const irrigation = (r) => r.strategies.slice(1).map((s) => s.totalIrrigationMm);
    // With water saving weighted heavily, the best alternative needs no more irrigation than before.
    expect(irrigation(thirsty)[0]).toBeLessThanOrEqual(irrigation(base)[0]);
  });
});

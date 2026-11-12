import { describe, it, expect } from 'vitest';
import { CROPS } from '../src/data/reference/crops.js';
import { cropClimate } from '../src/science/climate.js';
import {
  checkFeasible,
  compatibilityMap,
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
  }, 15000);
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

// ---- Bias fix: cropping intensity, staple cereal, documented patterns, ranking stability ------------------------------
import { patternInfo } from '../src/science/cropPatterns.js';
import { rankingStability, weightScenarios } from '../src/science/rankingStability.js';
import { effectiveWeights, stapleCount } from '../src/science/rotation.js';

describe('cropping intensity and staple cereal are scored', () => {
  const ctx = () => makeCtx();
  const comp = (rot, id) => scoreRotation(rot, ctx()).components.find((c) => c.id === id).value;

  it('cropping intensity is months in crop / 12', () => {
    expect(comp(crops('boro', 'aman'), 'croppingIntensity')).toBeCloseTo(11 / 12, 3);
    expect(comp(crops('mustard', 'mungbean'), 'croppingIntensity')).toBeLessThan(comp(crops('boro', 'aman'), 'croppingIntensity'));
  });
  it('staple security counts cereal crops, capped at two', () => {
    expect(stapleCount(crops('boro', 'aman'))).toBe(2);
    expect(comp(crops('boro', 'aman'), 'stapleSecurity')).toBe(1);
    expect(comp(crops('aman', 'mustard'), 'stapleSecurity')).toBe(0.5);
    expect(comp(crops('mustard', 'mungbean'), 'stapleSecurity')).toBe(0);
  });
  it('a rotation with no cereal and few months scores below the same plot with Boro and Aman on those two components', () => {
    const sparse = scoreRotation(crops('mustard', 'mungbean'), ctx());
    const double = scoreRotation(crops('boro', 'aman'), ctx());
    for (const id of ['croppingIntensity', 'stapleSecurity']) {
      expect(sparse.components.find((c) => c.id === id).value).toBeLessThan(double.components.find((c) => c.id === id).value);
    }
  });
});

describe('alternative filters', () => {
  const run = (constraints, existing = ['boro', 'aman']) => evaluateRotations({ crops: CROPS, existingSlugs: existing, ctx: makeCtx(), constraints });

  it('by default every alternative has a staple cereal and is a documented pattern; the existing rotation is still scored', () => {
    const r = run();
    expect(r.strategies[0].kind).toBe('existing');
    expect(r.strategies[0].score).not.toBeNull();
    expect(r.constraints.applied).toEqual({ requireStapleCereal: true, onlyDocumentedPatterns: true });
    for (const s of r.strategies.slice(1)) {
      expect(s.hasStapleCereal).toBe(true);
      expect(s.pattern.documented).toBe(true);
    }
    expect(r.constraints.excluded.noStapleCereal).toBeGreaterThan(0);
    expect(r.constraints.excluded.notDocumented).toBeGreaterThan(0);
    expect(r.alternativesConsidered).toBeLessThan(r.constraints.candidatesBeforeFilters);
  });
  it('switching the filters off restores every feasible alternative', () => {
    const r = run({ requireStapleCereal: false, onlyDocumentedPatterns: false });
    expect(r.alternativesConsidered).toBe(r.constraints.candidatesBeforeFilters);
    expect(r.constraints.excluded).toEqual({ noStapleCereal: 0, notDocumented: 0 });
  });
  it('flags an existing rotation that is not a documented pattern instead of hiding it', () => {
    const r = run({}, ['mustard', 'mungbean']);
    expect(r.strategies[0].pattern.documented).toBe(false);
    expect(r.strategies[0].hasStapleCereal).toBe(false);
    expect(r.strategies[0].risks.join(' ')).toMatch(/No staple cereal/);
  });
  it('says a low rank is not a verdict when the existing rotation is a documented pattern', () => {
    const r = run();
    const beating = r.strategies[0].summary.match(/(\d+) of (\d+) alternative/);
    if (beating && Number(beating[1]) >= Number(beating[2]) / 2) expect(r.strategies[0].summary).toMatch(/does not mean your system is wrong/);
  });
});

describe('cropping patterns', () => {
  it('Boro + Aman is documented (Boro-Fallow-T. Aman) and cites its sources', () => {
    const info = patternInfo(['boro', 'aman']);
    expect(info.documented).toBe(true);
    expect(info.matches.map((m) => m.id)).toContain('boro-fallow-aman');
    expect(info.sourceIds).toContain('rashid2017');
  });
  it('a subset of a pattern counts (a season may be left fallow); a combination in no pattern does not', () => {
    expect(patternInfo(['mustard', 'aman']).documented).toBe(true);
    expect(patternInfo(['potato', 'maize']).documented).toBe(false);
  });
  it('an empty or unknown crop list is never documented by accident', () => {
    expect(patternInfo(['unknown-crop']).documented).toBe(false);
  });
});

describe('ranking stability', () => {
  it('reports a stable pick when no weight change alters the order', () => {
    const r = rankingStability({ baseOrder: ['a', 'b', 'c'], effectiveWeights: { x: 1, y: 0 }, rank: () => ['a', 'b', 'c'] });
    expect(r).toMatchObject({ applicable: true, verdict: 'stable', topPickStaysFirstShare: 1 });
    expect(r.changes).toEqual([]);
  });
  it('reports a sensitive pick and names what flipped it', () => {
    const r = rankingStability({ baseOrder: ['a', 'b'], effectiveWeights: { x: 1, y: 1 }, rank: () => ['b', 'a'] });
    expect(r.verdict).toBe('sensitive');
    expect(r.changes[0]).toMatchObject({ component: 'x', newTop: 'b' });
  });
  it('tries a zero-weight component at 2 (what if you cared) and halves/doubles the others', () => {
    const sc = weightScenarios({ x: 2, y: 0 });
    expect(sc.map((s) => [s.component, s.overrides[s.component]])).toEqual([['x', 1], ['x', 4], ['y', 2]]);
  });
  it('is not applicable when there is nothing to rank', () => {
    expect(rankingStability({ baseOrder: [], effectiveWeights: { x: 1 }, rank: () => [] }).applicable).toBe(false);
  });
  it('evaluateRotations returns it, and a weight override changes the score but a request cannot set one', () => {
    const r = evaluateRotations({ crops: CROPS, existingSlugs: ['boro', 'aman'], ctx: makeCtx() });
    expect(r.stability.applicable).toBe(true);
    expect(r.stability.scenariosTried).toBeGreaterThan(10);
    expect(['stable', 'moderate', 'sensitive']).toContain(r.stability.verdict);
    const base = scoreRotation(crops('boro', 'aman'), makeCtx()).score;
    const changed = scoreRotation(crops('boro', 'aman'), { ...makeCtx(), weightOverrides: { croppingIntensity: 0 } }).score;
    expect(changed).not.toBe(base);
    expect(effectiveWeights(makeCtx()).croppingIntensity).toBeGreaterThan(0);
  });
});

describe('compatibilityMap', () => {
  it('lists, for each crop, only crops that can share a year with it', () => {
    const map = compatibilityMap(CROPS);
    expect(map.aman).toContain('boro');
    expect(map.aman).toContain('mustard');
    expect(map.aman).not.toContain('aman');
    expect(map.boro).not.toContain('aus'); // Apr-May overlap
    expect(map.boro).not.toContain('mustard');
  });
  it('is symmetric and agrees with checkFeasible for every pair', () => {
    const map = compatibilityMap(CROPS);
    for (const a of CROPS) {
      for (const b of CROPS) {
        if (a.slug === b.slug) continue;
        expect(map[a.slug].includes(b.slug)).toBe(checkFeasible([a, b]).ok);
        expect(map[a.slug].includes(b.slug)).toBe(map[b.slug].includes(a.slug));
      }
    }
  });
  it('picking from the intersection always gives a feasible set of three', () => {
    const map = compatibilityMap(CROPS);
    const [first] = ['aman'];
    for (const second of map[first]) {
      for (const third of map[first].filter((s) => map[second].includes(s))) {
        expect(checkFeasible(crops(first, second, third)).ok).toBe(true);
      }
    }
  });
});

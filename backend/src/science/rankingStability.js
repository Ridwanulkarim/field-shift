// Ranking-stability check: does the top pick survive reasonable changes to the component weights?
// Pure function. The weights are judgment calls, so a recommendation that flips when one weight is halved or doubled is
// reported as sensitive instead of being presented as the answer.
//
// rank(overrides) must return the candidate ids best-first for a given { componentId: absoluteWeight } override.

import { STABILITY } from './rules.js';

// Scenarios: for every component, its weight halved, and doubled (or set to `upFloor` x factor when it is 0, i.e. "what if you cared").
export function weightScenarios(effectiveWeights, { down = STABILITY.downFactor, up = STABILITY.upFactor, floor = STABILITY.upFloor } = {}) {
  const out = [];
  for (const [id, w] of Object.entries(effectiveWeights)) {
    if (w > 0) out.push({ component: id, change: 'halved', overrides: { [id]: w * down } });
    out.push({ component: id, change: w > 0 ? 'doubled' : 'raised from 0 to 2', overrides: { [id]: Math.max(w, floor) * up } });
  }
  return out;
}

export function rankingStability({ baseOrder, effectiveWeights, rank }) {
  if (baseOrder.length === 0) return { applicable: false, reason: 'no alternatives to rank' };
  const top = baseOrder[0];
  const scenarios = weightScenarios(effectiveWeights);
  let first = 0;
  let inTop3 = 0;
  const flips = [];
  for (const sc of scenarios) {
    const order = rank(sc.overrides);
    if (order[0] === top) first += 1;
    if (order.slice(0, 3).includes(top)) inTop3 += 1;
    if (order[0] !== top) flips.push({ component: sc.component, change: sc.change, newTop: order[0] });
  }
  const n = scenarios.length;
  const share = first / n;
  const verdict = share >= STABILITY.stableShare ? 'stable' : share >= STABILITY.moderateShare ? 'moderate' : 'sensitive';
  const text = {
    stable: 'The top-ranked rotation stays first in most of the weight changes tried, so the ranking does not hinge on one weight.',
    moderate: 'The top-ranked rotation stays first in about half or more of the weight changes tried; treat the top few options as close.',
    sensitive: 'The top-ranked rotation often changes when a weight changes. Treat the top options as roughly equal and decide on practical grounds.',
  }[verdict];
  return {
    applicable: true,
    topPick: top,
    scenariosTried: n,
    topPickStaysFirst: first,
    topPickStaysFirstShare: Math.round(share * 100) / 100,
    topPickStaysInTop3: inTop3,
    verdict,
    explanation: text,
    changes: flips.slice(0, 6),
    method: `Each component weight halved, and doubled (a weight of 0 is tried at 2), one at a time: ${n} scenarios on the same candidates.`,
  };
}

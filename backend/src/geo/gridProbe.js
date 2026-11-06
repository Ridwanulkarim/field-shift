// Pure helpers for checking the assumed climate grid against real data. No network, no database.
// Used by scripts/check-power-grid.js (live probe) and scripts/check-grid-consistency.js (stored data).

// Samples are taken along a line, in increasing position, each with a "signature" (the data returned for that point).
// An edge lies between two neighbouring samples whose signatures differ.
export function detectEdges(samples) {
  const edges = [];
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].signature !== samples[i - 1].signature) {
      edges.push({ between: [samples[i - 1].pos, samples[i].pos], estimate: (samples[i - 1].pos + samples[i].pos) / 2 });
    }
  }
  return edges;
}

// Compares detected edges with the expected ones. An edge is matched when it lies within `tolerance` degrees.
export function matchEdges(detected, expected, tolerance) {
  const unmatchedDetected = new Set(detected.map((_, i) => i));
  const matched = [];
  const missing = [];
  for (const edge of expected) {
    let best = -1;
    for (const i of unmatchedDetected) {
      if (Math.abs(detected[i].estimate - edge) <= tolerance && (best === -1 || Math.abs(detected[i].estimate - edge) < Math.abs(detected[best].estimate - edge))) best = i;
    }
    if (best === -1) {
      missing.push(edge);
    } else {
      unmatchedDetected.delete(best);
      matched.push({ expected: edge, detected: detected[best].estimate, offset: detected[best].estimate - edge });
    }
  }
  return { matched, missing, unexpected: [...unmatchedDetected].map((i) => detected[i].estimate), ok: missing.length === 0 && unmatchedDetected.size === 0 };
}

// Stored-data check. items: [{ slug, cellKey, fingerprint }] (one per district, from its newest real run).
// If the assumed grid is right, districts in one cell have IDENTICAL data and districts in different cells do not.
export function compareGroupings(items) {
  const sameCellDifferentData = [];
  const sameDataDifferentCell = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]; const b = items[j];
      if (a.cellKey === b.cellKey && a.fingerprint !== b.fingerprint) sameCellDifferentData.push([a.slug, b.slug]);
      if (a.cellKey !== b.cellKey && a.fingerprint === b.fingerprint) sameDataDifferentCell.push([a.slug, b.slug]);
    }
  }
  return { sameCellDifferentData, sameDataDifferentCell, consistent: sameCellDifferentData.length === 0 && sameDataDifferentCell.length === 0 };
}

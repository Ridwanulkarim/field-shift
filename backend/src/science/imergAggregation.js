// Aggregates NATIVE GPM IMERG pixel values (0.1 degree) to one value per day for a larger area, so they can be compared
// with a coarser product such as NASA POWER. This is a separate, read-time operation: the stored IMERG data is never
// changed, and nothing here touches the POWER data.
//
// METHOD (documented in every result): for each day, the plain arithmetic mean of the pixels that have a valid value that
// day. A pixel counts when its value is a number (zero rain counts; a missing pixel is never zero). The day is kept only
// when at least MIN_VALID_PIXEL_SHARE of ALL pixels whose centres lie in the area have a value; otherwise it is missing.
// Pixels are weighted equally (no area or cosine-latitude weighting) and pixels are assigned to the area by their centre,
// not by partial overlap.
//
// SPATIAL LIMITATIONS: the pixel centres chosen for a POWER cell are an approximation of that cell's footprint, so the
// IMERG support and the POWER support are comparable but not identical. A pixel whose centre is just outside the cell is
// left out even if it overlaps it. The POWER value describes a 0.5 x 0.625 degree cell of a reanalysis-based product; IMERG
// pixels describe about 10 km. Neither describes a single farm.

export const MIN_VALID_PIXEL_SHARE = 0.8;

export const AGGREGATION_METHOD = Object.freeze({
  name: 'equal-weight mean of valid 0.1 degree pixels whose centres lie inside the NASA POWER cell',
  minValidPixelShare: MIN_VALID_PIXEL_SHARE,
  weighting: 'equal (no area weighting)',
  pixelAssignment: 'by pixel centre; lower edge inclusive, upper edge exclusive',
  missingPixels: 'a pixel without a value is excluded, never counted as zero; a day with too few valid pixels is missing',
});

export const AGGREGATION_LIMITATIONS = Object.freeze([
  'The IMERG pixels are chosen by their centres, so the area they cover only approximates the NASA POWER cell footprint.',
  'Pixels are averaged with equal weight; no area or latitude weighting is applied.',
  'IMERG (about 10 km pixels) and the NASA POWER cell (about 0.5 x 0.625 degrees) describe different spatial scales; neither describes a single farm.',
]);

// rows: [{ cellKey, date, precipMm|null, precipitationCnt|null }] for the pixels of one area.
// expectedPixels: how many pixels the area contains (35 for a typical POWER cell).
export function aggregatePixelRows(rows, { expectedPixels, minValidShare = MIN_VALID_PIXEL_SHARE } = {}) {
  if (!Number.isInteger(expectedPixels) || expectedPixels < 1) throw new Error('expectedPixels must be a positive whole number.');
  const byDate = new Map();
  const pixelsWithData = new Set();
  for (const r of rows) {
    pixelsWithData.add(r.cellKey);
    const g = byDate.get(r.date) ?? { sum: 0, valid: 0, cnts: [] };
    if (typeof r.precipMm === 'number' && Number.isFinite(r.precipMm)) {
      g.sum += r.precipMm;
      g.valid += 1;
      if (Number.isInteger(r.precipitationCnt)) g.cnts.push(r.precipitationCnt);
    }
    byDate.set(r.date, g);
  }
  const series = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, g]) => {
    const enough = g.valid >= minValidShare * expectedPixels;
    return {
      date,
      precipMm: enough ? Math.round((g.sum / g.valid) * 1000) / 1000 : null,
      validPixels: g.valid,
      pixelCount: expectedPixels,
      meanHalfHourCount: g.cnts.length ? Math.round((g.cnts.reduce((a, b) => a + b, 0) / g.cnts.length) * 10) / 10 : null,
      minHalfHourCount: g.cnts.length ? Math.min(...g.cnts) : null,
    };
  });
  return {
    series,
    pixelsExpected: expectedPixels,
    pixelsWithData: pixelsWithData.size,
    complete: pixelsWithData.size === expectedPixels,
    method: AGGREGATION_METHOD,
    limitations: AGGREGATION_LIMITATIONS,
  };
}

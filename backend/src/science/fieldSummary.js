// One plain-English paragraph for a field, built ONLY from numbers the profile already computed.
// Pure function. Nothing is typed in: every figure, month and crop name comes from its arguments.
// The wording describes the cell's past climate and the crop table's assumptions. It never predicts,
// ranks crops, or claims anything about yield.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MAX_NAMES = 6;

function nameList(names) {
  if (names.length <= MAX_NAMES) return names.join(', ');
  return `${names.slice(0, MAX_NAMES).join(', ')} and ${names.length - MAX_NAMES} more`;
}

// monthly: output of monthlyClimatology; crops: output of cropFieldEvidence (array);
// cell: { approxAreaKm2 }; soil: { salinityClass, salinityDsM }
export function buildFieldSummary({ monthly, crops, cell, areaHa, soil, spansMultipleCells }) {
  const parts = [];
  const sizeNote = areaHa === null || areaHa === undefined ? '' : ` (the field is ${areaHa} ha)`;
  parts.push(`This describes the NASA POWER grid cell that contains the field, about ${cell.approxAreaKm2.toLocaleString('en-US')} km2${sizeNote}, not measurements taken on the field.`);

  const withRain = monthly.filter((m) => m.rainMm.mean !== null);
  if (withRain.length) {
    const wettest = withRain.reduce((a, b) => (b.rainMm.mean > a.rainMm.mean ? b : a));
    const driest = withRain.reduce((a, b) => (b.rainMm.mean < a.rainMm.mean ? b : a));
    parts.push(`Over the years with enough data, ${MONTHS[wettest.month - 1]} is the wettest month on average (${wettest.rainMm.mean} mm) and ${MONTHS[driest.month - 1]} the driest (${driest.rainMm.mean} mm).`);
  } else {
    parts.push('There is not enough rainfall data to describe the months.');
  }

  const short = crops.filter((c) => c.seasonRain.shortfallMm && c.seasonRain.shortfallMm.atMinNeed > 0);
  if (crops.length && short.length) {
    parts.push(`Average rainfall during the growing months is below the minimum water need assumed in the crop table for ${short.length} of ${crops.length} crops: ${nameList(short.map((c) => c.nameEn))}. Rain alone does not decide whether a crop can be grown, and the crop values are unverified.`);
  } else if (crops.length) {
    parts.push(`For none of the ${crops.length} crops is average growing-season rainfall below the minimum water need assumed in the crop table (the crop values are unverified).`);
  }

  if (soil.salinityClass === null || soil.salinityClass === undefined) {
    parts.push('No soil salinity was entered, so soil fit was not checked.');
  } else {
    const bad = crops.filter((c) => c.salinity.compatibility === 'exceeds_tolerance');
    parts.push(bad.length
      ? `The salinity you entered (${soil.salinityDsM} dS/m, class "${soil.salinityClass}") is above the tolerance assumed for: ${nameList(bad.map((c) => c.nameEn))}.`
      : `The salinity you entered (${soil.salinityDsM} dS/m, class "${soil.salinityClass}") is within the tolerance assumed for every crop in the table.`);
  }

  if (spansMultipleCells) parts.push('The field crosses a grid-cell edge, so part of it lies in a neighbouring cell.');
  parts.push('This is the cell\'s past climate, not a forecast. Check with your local agricultural extension officer before changing what you grow.');
  return parts.join(' ');
}

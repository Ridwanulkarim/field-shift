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

// ---------------------------------------------------------------------------------------------
// Bangla version of the same paragraph. FIRST DRAFT: it must be reviewed by a native speaker before it is
// shown to farmers (the response labels it BANGLA_DRAFT_NOT_NATIVE_REVIEWED). Same arguments, same numbers.
// Every digit is converted to Bangla digits, so the text never contains an ASCII digit.

import { toBnDigits } from './plantingAdvisory.js';

const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const SALINITY_CLASS_BN = { none: 'নেই', slight: 'সামান্য', moderate: 'মাঝারি', high: 'বেশি' };

function nameListBn(names) {
  if (names.length <= MAX_NAMES) return names.join(', ');
  return `${names.slice(0, MAX_NAMES).join(', ')} এবং আরও ${toBnDigits(names.length - MAX_NAMES)}টি`;
}
const cropNameBn = (c) => c.nameBn ?? c.nameEn;

export function buildFieldSummaryBn({ monthly, crops, cell, areaHa, soil, spansMultipleCells }) {
  const parts = [];
  const sizeNote = areaHa === null || areaHa === undefined ? '' : `; ক্ষেতটি ${toBnDigits(areaHa)} হেক্টর`;
  parts.push(`এই তথ্য ক্ষেতটি যে NASA POWER গ্রিড সেলের মধ্যে পড়েছে তার (প্রায় ${toBnDigits(cell.approxAreaKm2.toLocaleString('en-US'))} বর্গকিমি${sizeNote}), ক্ষেতে সরাসরি মাপা তথ্য নয়।`);

  const withRain = monthly.filter((m) => m.rainMm.mean !== null);
  if (withRain.length) {
    const wettest = withRain.reduce((a, b) => (b.rainMm.mean > a.rainMm.mean ? b : a));
    const driest = withRain.reduce((a, b) => (b.rainMm.mean < a.rainMm.mean ? b : a));
    parts.push(`পর্যাপ্ত তথ্যসহ বছরগুলোর গড়ে ${MONTHS_BN[wettest.month - 1]} সবচেয়ে বৃষ্টিবহুল মাস (${toBnDigits(wettest.rainMm.mean)} মিমি) এবং ${MONTHS_BN[driest.month - 1]} সবচেয়ে শুষ্ক (${toBnDigits(driest.rainMm.mean)} মিমি)।`);
  } else {
    parts.push('মাসভিত্তিক বৃষ্টির পরিসংখ্যান দেওয়ার মতো পর্যাপ্ত তথ্য নেই।');
  }

  const short = crops.filter((c) => c.seasonRain.shortfallMm && c.seasonRain.shortfallMm.atMinNeed > 0);
  if (crops.length && short.length) {
    parts.push(`ফসলের সারণিতে ধরে নেওয়া ন্যূনতম পানির চাহিদার চেয়ে ${toBnDigits(crops.length)}টি ফসলের মধ্যে ${toBnDigits(short.length)}টির বেড়ে ওঠার মাসগুলোর গড় বৃষ্টি কম: ${nameListBn(short.map(cropNameBn))}। শুধু বৃষ্টি দিয়ে ঠিক হয় না কোন ফসল চাষ করা যাবে, এবং ফসলের এই মানগুলো এখনো যাচাই করা হয়নি।`);
  } else if (crops.length) {
    parts.push(`${toBnDigits(crops.length)}টি ফসলের কোনোটির ক্ষেত্রেই বেড়ে ওঠার মাসগুলোর গড় বৃষ্টি সারণিতে ধরে নেওয়া ন্যূনতম পানির চাহিদার চেয়ে কম নয় (ফসলের মানগুলো যাচাই করা হয়নি)।`);
  }

  if (soil.salinityClass === null || soil.salinityClass === undefined) {
    parts.push('মাটির লবণাক্ততা দেওয়া হয়নি, তাই মাটির উপযোগিতা পরীক্ষা করা হয়নি।');
  } else {
    const bad = crops.filter((c) => c.salinity.compatibility === 'exceeds_tolerance');
    const given = `আপনার দেওয়া লবণাক্ততা (${toBnDigits(soil.salinityDsM)} ডিএস/মি, শ্রেণি "${SALINITY_CLASS_BN[soil.salinityClass] ?? soil.salinityClass}")`;
    parts.push(bad.length
      ? `${given} এই ফসলগুলোর ধরে নেওয়া সহনসীমার বেশি: ${nameListBn(bad.map(cropNameBn))}।`
      : `${given} সারণির সব ফসলের ধরে নেওয়া সহনসীমার মধ্যে।`);
  }

  if (spansMultipleCells) parts.push('ক্ষেতটি একটি গ্রিড সেলের সীমানা পেরিয়েছে, তাই এর একটি অংশ পাশের সেলে পড়ে।');
  parts.push('এটি এই সেলের অতীত জলবায়ুর তথ্য, পূর্বাভাস নয়। কী চাষ করবেন তা বদলানোর আগে স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।');
  return parts.join(' ');
}

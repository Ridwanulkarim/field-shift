// Pilot districts. NOT all 64: the pipeline is the same for any district, but each one
// needs a verified coordinate and (later) local review, so we start with a spread.
//
// COORDINATES ARE APPROXIMATE district-headquarters positions typed from general knowledge,
// not taken from an official gazetteer. NASA POWER meteorology comes on a grid of roughly
// 0.5 degrees (tens of km), so errors of a few km do not change which cell is used, but
// please verify them before any claim beyond "indicative".

const NOTE =
  'Approximate district-headquarters coordinates (general knowledge, not an official gazetteer). ' +
  'NASA POWER cells are ~0.5 degrees wide, so values describe the surrounding grid cell, not one farm.';

export const DISTRICTS = [
  { slug: 'rajshahi', nameEn: 'Rajshahi', nameBn: 'রাজশাহী', division: 'Rajshahi', latitude: 24.37, longitude: 88.6 },
  { slug: 'bogura', nameEn: 'Bogura', nameBn: 'বগুড়া', division: 'Rajshahi', latitude: 24.85, longitude: 89.37 },
  { slug: 'dinajpur', nameEn: 'Dinajpur', nameBn: 'দিনাজপুর', division: 'Rangpur', latitude: 25.63, longitude: 88.64 },
  { slug: 'rangpur', nameEn: 'Rangpur', nameBn: 'রংপুর', division: 'Rangpur', latitude: 25.75, longitude: 89.25 },
  { slug: 'dhaka', nameEn: 'Dhaka', nameBn: 'ঢাকা', division: 'Dhaka', latitude: 23.81, longitude: 90.41 },
  { slug: 'mymensingh', nameEn: 'Mymensingh', nameBn: 'ময়মনসিংহ', division: 'Mymensingh', latitude: 24.75, longitude: 90.4 },
  { slug: 'sylhet', nameEn: 'Sylhet', nameBn: 'সিলেট', division: 'Sylhet', latitude: 24.9, longitude: 91.87 },
  { slug: 'cumilla', nameEn: 'Cumilla', nameBn: 'কুমিল্লা', division: 'Chattogram', latitude: 23.46, longitude: 91.18 },
  { slug: 'chattogram', nameEn: 'Chattogram', nameBn: 'চট্টগ্রাম', division: 'Chattogram', latitude: 22.36, longitude: 91.78 },
  { slug: 'khulna', nameEn: 'Khulna', nameBn: 'খুলনা', division: 'Khulna', latitude: 22.82, longitude: 89.55 },
  { slug: 'jashore', nameEn: 'Jashore', nameBn: 'যশোর', division: 'Khulna', latitude: 23.17, longitude: 89.21 },
  { slug: 'barishal', nameEn: 'Barishal', nameBn: 'বরিশাল', division: 'Barishal', latitude: 22.7, longitude: 90.37 },
].map((d) => ({ ...d, coordNote: NOTE }));

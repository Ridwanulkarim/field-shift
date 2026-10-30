// Crop trait table used by the rotation engine.
//
// IMPORTANT, READ BEFORE TRUSTING ANY NUMBER HERE
// These values are rough, general-knowledge agronomic descriptions typed in by the
// developer (an AI assistant) to make the engine runnable. They are NOT taken from a
// specific BRRI / BARI / FAO table and have NOT been checked by an agronomist.
// Every row is therefore marked UNVERIFIED_GENERAL_KNOWLEDGE and the app shows that
// label next to the evidence. Replace values (and change `basis`) as you verify them.
//
// Meaning of the fields
//   startMonth/endMonth       typical months the crop occupies the field (1-12, may wrap
//                             past December, e.g. Boro 12 -> 5)
//   waterNeed*                approximate seasonal water need in mm, including losses
//   heatThresholdC            daily maximum temperature we treat as heat stress
//   heatSensitivity           1 tolerant ... 5 sensitive
//   salinityTolerance         1 sensitive ... 5 tolerant
//   waterloggingTolerance     1 sensitive ... 5 tolerant
//   inputIntensity            1 low input ... 5 high input (fertiliser, irrigation, labour)

export const UNVERIFIED = 'UNVERIFIED_GENERAL_KNOWLEDGE';

export const CROPS = [
  {
    slug: 'aman', nameEn: 'Aman rice', nameBn: 'আমন ধান', family: 'Poaceae', isLegume: false,
    startMonth: 7, endMonth: 11, waterNeedMmMin: 800, waterNeedMmMax: 1200,
    heatThresholdC: 35, heatSensitivity: 3, salinityTolerance: 2, waterloggingTolerance: 4, inputIntensity: 3,
    notes: 'Monsoon-season transplanted rice. Mostly rain-fed; supplemental irrigation in dry spells.',
  },
  {
    slug: 'boro', nameEn: 'Boro rice', nameBn: 'বোরো ধান', family: 'Poaceae', isLegume: false,
    startMonth: 12, endMonth: 5, waterNeedMmMin: 1000, waterNeedMmMax: 1500,
    heatThresholdC: 35, heatSensitivity: 4, salinityTolerance: 2, waterloggingTolerance: 4, inputIntensity: 5,
    notes: 'Dry-season irrigated rice. Depends heavily on irrigation water; spring heat can hurt flowering.',
  },
  {
    slug: 'aus', nameEn: 'Aus rice', nameBn: 'আউশ ধান', family: 'Poaceae', isLegume: false,
    startMonth: 4, endMonth: 7, waterNeedMmMin: 700, waterNeedMmMax: 1000,
    heatThresholdC: 35, heatSensitivity: 3, salinityTolerance: 2, waterloggingTolerance: 3, inputIntensity: 3,
    notes: 'Pre-monsoon to early-monsoon rice. Depends on early rain.',
  },
  {
    slug: 'wheat', nameEn: 'Wheat', nameBn: 'গম', family: 'Poaceae', isLegume: false,
    startMonth: 11, endMonth: 3, waterNeedMmMin: 350, waterNeedMmMax: 450,
    heatThresholdC: 32, heatSensitivity: 4, salinityTolerance: 3, waterloggingTolerance: 1, inputIntensity: 3,
    notes: 'Cool-season cereal. Late-season heat during grain filling is a known risk.',
  },
  {
    slug: 'mustard', nameEn: 'Mustard', nameBn: 'সরিষা', family: 'Brassicaceae', isLegume: false,
    startMonth: 11, endMonth: 2, waterNeedMmMin: 250, waterNeedMmMax: 350,
    heatThresholdC: 30, heatSensitivity: 3, salinityTolerance: 3, waterloggingTolerance: 1, inputIntensity: 2,
    notes: 'Short-duration oilseed, low irrigation need.',
  },
  {
    slug: 'potato', nameEn: 'Potato', nameBn: 'আলু', family: 'Solanaceae', isLegume: false,
    startMonth: 11, endMonth: 2, waterNeedMmMin: 400, waterNeedMmMax: 600,
    heatThresholdC: 30, heatSensitivity: 5, salinityTolerance: 2, waterloggingTolerance: 1, inputIntensity: 5,
    notes: 'Cool-season tuber crop, high input, sensitive to warm spells.',
  },
  {
    slug: 'lentil', nameEn: 'Lentil', nameBn: 'মসুর', family: 'Fabaceae', isLegume: true,
    startMonth: 11, endMonth: 3, waterNeedMmMin: 200, waterNeedMmMax: 300,
    heatThresholdC: 32, heatSensitivity: 3, salinityTolerance: 2, waterloggingTolerance: 1, inputIntensity: 1,
    notes: 'Winter pulse, low water and input need, nitrogen-fixing legume.',
  },
  {
    slug: 'maize', nameEn: 'Maize (rabi)', nameBn: 'ভুট্টা (রবি)', family: 'Poaceae', isLegume: false,
    startMonth: 11, endMonth: 4, waterNeedMmMin: 500, waterNeedMmMax: 700,
    heatThresholdC: 35, heatSensitivity: 3, salinityTolerance: 2, waterloggingTolerance: 1, inputIntensity: 4,
    notes: 'Dry-season maize, needs irrigation and fertiliser.',
  },
  {
    slug: 'mungbean', nameEn: 'Mungbean', nameBn: 'মুগ', family: 'Fabaceae', isLegume: true,
    startMonth: 3, endMonth: 5, waterNeedMmMin: 200, waterNeedMmMax: 300,
    heatThresholdC: 35, heatSensitivity: 2, salinityTolerance: 1, waterloggingTolerance: 1, inputIntensity: 1,
    notes: 'Very short-duration pulse that fits between rabi and monsoon crops.',
  },
  {
    slug: 'jute', nameEn: 'Jute', nameBn: 'পাট', family: 'Malvaceae', isLegume: false,
    startMonth: 4, endMonth: 7, waterNeedMmMin: 500, waterNeedMmMax: 700,
    heatThresholdC: 36, heatSensitivity: 2, salinityTolerance: 2, waterloggingTolerance: 3, inputIntensity: 3,
    notes: 'Fibre crop grown pre-monsoon to early monsoon.',
  },
].map((c) => ({ ...c, basis: UNVERIFIED }));

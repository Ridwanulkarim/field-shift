/**
 * Field Shift - Internationalization & Agricultural Dictionary (Spec Section 53)
 * Bilingual support for English ('en') and বাংলা ('bn').
 */

export const translations = {
  en: {
    // Brand & Header
    app_title: 'FIELD SHIFT',
    app_subtitle: 'Adapting Farms with NASA Earth Observations • Bangladesh Decision Support',
    api_online: 'API: Online',
    api_connecting: 'API: Connecting',
    checkpoint_badge: 'Checkpoint 3 Active • Full Disclosures & Bilingual',

    // Navigation
    nav_dashboard: '📊 Field Dashboard',
    nav_planner: '🌱 Rotation Planner',
    nav_comparison: '⚖️ Compare Rotations',
    nav_recommendation: '🎯 Recommendation',
    nav_fields: '🗺️ 5 Demo Fields',

    // Field Status & Condition Labels (Spec Section 25)
    healthy_condition: 'Healthy relative condition',
    watch_closely: 'Watch closely',
    moderate_stress: 'Moderate stress',
    high_stress: 'High stress',
    field_condition_score: 'Field Condition Score',
    condition_overview: 'Satellite-Observed Field Condition',
    analysis_window: 'Analysis Window',
    baseline_doy: 'Historical Baseline DOY',
    quality_usable: 'Usable (Crop-Matched)',
    irrigated_status: 'Irrigated (STW / Canal)',
    rainfed_status: 'Rainfed (No STW)',

    // Environmental Stresses
    water_stress: 'Water Stress',
    heat_stress: 'Heat Stress',
    veg_stress: 'Vegetation Condition',
    water_stress_desc: 'SMAP soil moisture & GPM 30d rainfall deficit',
    heat_stress_desc: 'MODIS LST daytime/nighttime anomaly & hot days',
    veg_stress_desc: 'Harmonized Landsat-Sentinel (HLS) 30m EVI anomaly',

    // Priorities (Spec Section 37)
    farmer_priorities: 'Farmer Priorities & NASA Multipliers',
    water_priority: 'Water Conservation Priority',
    heat_priority: 'Heat Avoidance Priority',
    soil_priority: 'Soil Health Priority',
    diversity_priority: 'Crop Diversity Priority',
    profitability_priority: 'Market Profitability Priority',
    effective_weight: 'Eff. Weight',
    climate_multiplier: 'NASA Climate Multiplier',

    // Terminology Guardrails (Spec Section 50)
    highest_scoring: 'Highest-scoring rotation',
    rank_candidate: 'Rank Candidate',
    score_points: 'pts',

    // Common Crops
    crop_chickpea: 'Chickpea (ছোলা)',
    crop_mungbean: 'Mung Bean (মুগ ডাল)',
    crop_lentil: 'Lentil (মসুর ডাল)',
    crop_wheat: 'Wheat (গম)',
    crop_bororice: 'Boro Rice (বোরো ধান)',
    crop_amanrice: 'T. Aman Rice (রোপা আমন ধান)',
    crop_potato: 'Potato (গোল আলু)',
    crop_mustard: 'Mustard (সরিষা)',
    crop_maize: 'Maize (ভুট্টা)',
    crop_jute: 'Jute (পাট)',

    // Disclosures Header (Spec Section 56)
    disclosures_title: 'Scientific Disclosures & Operating Limitations',
    disclosures_subtitle: 'Mandatory agronomic and remote-sensing caveats governing MVP decision support.'
  },

  bn: {
    // Brand & Header
    app_title: 'ফিল্ড শিফট (FIELD SHIFT)',
    app_subtitle: 'নাসা স্যাটেলাইট তথ্যের মাধ্যমে কৃষি অভিযোজন • বাংলাদেশ সিদ্ধান্ত সহায়তা ব্যবস্থা',
    api_online: 'এপিআই: সক্রিয়',
    api_connecting: 'এপিআই: সংযোগ হচ্ছে',
    checkpoint_badge: 'চেকপয়েন্ট ৩ সক্রিয় • দ্বৈত ভাষা ও সম্পূর্ণ নীতিমালা',

    // Navigation
    nav_dashboard: '📊 মাঠ ড্যাশবোর্ড',
    nav_planner: '🌱 ফসল চক্র পরিকল্পনাকারী',
    nav_comparison: '⚖️ ঘূর্ণন তুলনা',
    nav_recommendation: '🎯 চূড়ান্ত সুপারিশ',
    nav_fields: '🗺️ ৫টি প্রদর্শনী মাঠ',

    // Field Status & Condition Labels (Spec Section 25)
    healthy_condition: 'তুলনামূলক স্বাস্থ্যকর অবস্থা',
    watch_closely: 'সতর্ক পর্যবেক্ষণ প্রয়োজন',
    moderate_stress: 'মাঝারি পরিবেশগত চাপ',
    high_stress: 'উচ্চ পরিবেশগত চাপ',
    field_condition_score: 'মাঠের সামগ্রিক অবস্থা স্কোর',
    condition_overview: 'উপগ্রহ পর্যবেক্ষণে বর্তমান মাঠের অবস্থা',
    analysis_window: 'পর্যবেক্ষণ সময়কাল',
    baseline_doy: 'ঐতিহাসিক বেসলাইন দিন (DOY)',
    quality_usable: 'ব্যবহারযোগ্য (ফসল-সামঞ্জস্যপূর্ণ)',
    irrigated_status: 'সেচ সুবিধা সম্পন্ন (নলকূপ/খাল)',
    rainfed_status: 'বৃষ্টি-নির্ভর (সেচ সুবিধা বিহীন)',

    // Environmental Stresses
    water_stress: 'পানির ঘাটতি ও আর্দ্রতা চাপ',
    heat_stress: 'উচ্চ তাপমাত্রা ও তাপীয় চাপ',
    veg_stress: 'উদ্ভিদের স্বাস্থ্য ও ক্যানোপি অবস্থা',
    water_stress_desc: 'SMAP মাটির আর্দ্রতা এবং GPM ৩০ দিনের বৃষ্টিপাত ঘাটতি',
    heat_stress_desc: 'MODIS LST ভূপৃষ্ঠের তাপমাত্রা ও অতিরিক্ত উষ্ণ দিনের সংখ্যা',
    veg_stress_desc: 'HLS ৩০-মিটার রেজোলিউশনে EVI সূচকের অস্বাভাবিকতা',

    // Priorities (Spec Section 37)
    farmer_priorities: 'কৃষকের অগ্রাধিকার ও নাসা গুণক',
    water_priority: 'পানি সংরক্ষণ অগ্রাধিকার',
    heat_priority: 'তাপ সহনশীলতা অগ্রাধিকার',
    soil_priority: 'মাটির স্বাস্থ্য বৃদ্ধি অগ্রাধিকার',
    diversity_priority: 'ফসল বৈচিত্র্য অগ্রাধিকার',
    profitability_priority: 'বাজার লাভজনকতা অগ্রাধিকার',
    effective_weight: 'কার্যকর গুরুত্ব',
    climate_multiplier: 'নাসা জলবায়ু গুণক',

    // Terminology Guardrails (Spec Section 50)
    highest_scoring: 'সর্বোচ্চ স্কোরপ্রাপ্ত ফসল ঘূর্ণন',
    rank_candidate: 'স্থান প্রাপ্ত বিকল্প',
    score_points: 'পয়েন্ট',

    // Common Crops
    crop_chickpea: 'ছোলা (Chickpea)',
    crop_mungbean: 'মুগ ডাল (Mung Bean)',
    crop_lentil: 'মসুর ডাল (Lentil)',
    crop_wheat: 'গম (Wheat)',
    crop_bororice: 'বোরো ধান (Boro Rice)',
    crop_amanrice: 'রোপা আমন ধান (T. Aman Rice)',
    crop_potato: 'গোল আলু (Potato)',
    crop_mustard: 'সরিষা (Mustard)',
    crop_maize: 'ভুট্টা (Maize)',
    crop_jute: 'পাট (Jute)',

    // Disclosures Header (Spec Section 56)
    disclosures_title: 'বৈজ্ঞানিক নীতিমালা ও সীমাবদ্ধতা সংক্রান্ত ঘোষণা',
    disclosures_subtitle: 'সিদ্ধান্ত সহায়তা ব্যবস্থার আওতাধীন ৭টি বাধ্যতামূলক কৃষি ও রিমোট-সেন্সিং সতর্কতা।'
  }
};

/**
 * 7 Mandatory Spec Section 56 Disclosures in English and Bengali
 */
export const MANDATORY_DISCLOSURES = [
  {
    id: 'decision_support',
    number: 1,
    title_en: 'Decision Support Disclaimer',
    title_bn: 'সিদ্ধান্ত সহায়তা সতর্কবার্তা',
    text_en: 'Field Shift is a decision-support prototype based on NASA satellite observations, farmer inputs, and transparent agronomic scoring rules. It does not replace soil laboratory testing, local agricultural extension knowledge, or on-farm agronomic advice.',
    text_bn: 'ফিল্ড শিফট হলো নাসা উপগ্রহ তথ্য, কৃষকের তথ্য এবং স্বচ্ছ কৃষি নিয়মের ওপর ভিত্তি করে তৈরি একটি সিদ্ধান্ত সহায়তা প্রোটোটাইপ। এটি কোনোভাবেই মৃত্তিকা গবেষণাগারের পরীক্ষা, স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তরের পরামর্শ কিংবা মাঠ পর্যায়ের বিশেষজ্ঞ মতামতকে প্রতিস্থাপন করে না।'
  },
  {
    id: 'not_a_forecast',
    number: 2,
    title_en: 'Not a Weather Forecast',
    title_bn: 'আবহাওয়ার পূর্বাভাস নয়',
    text_en: 'Recent NASA observations reflect current satellite-observed environmental pressures over the 61-day analysis window, not predictive seasonal weather forecasts.',
    text_bn: 'সাম্প্রতিক নাসা উপগ্রহ পর্যবেক্ষণ বিগত ৬১ দিনের পরিবেশগত চাপ তুলে ধরে। এটি কোনো দীর্ঘমেয়াদী আবহাওয়া বা জলবায়ুর পূর্বাভাস নয়।'
  },
  {
    id: 'simplified_seasons',
    number: 3,
    title_en: 'Simplified Seasonal Calendar Windows',
    title_bn: 'অনুকরণমূলক মৌসুমী সময়কাল',
    text_en: 'Seasonal calendar windows (Rabi: 120d, Kharif-1: 122d, Kharif-2: 123d) are simplified approximations based on canonical BARI guidelines; real sowing dates depend on monsoon arrival, residual soil moisture, and localized conditions.',
    text_bn: 'মৌসুমী ক্যালেন্ডারের সময়কাল (রবি: ১২০ দিন, খরিপ-১: ১২২ দিন, খরিপ-২: ১২৩ দিন) বারি নির্দেশিকার ওপর ভিত্তি করে অনুকরণমূলকভাবে নির্ধারিত; প্রকৃত বপনকাল বর্ষা আগমন ও স্থানীয় পরিবেশের ওপর নির্ভরশীল।'
  },
  {
    id: 'flood_limitation',
    number: 4,
    title_en: 'Riverine Flood & Inundation Limitation',
    title_bn: 'বন্যা ও জলাবদ্ধতা সংক্রান্ত সীমাবদ্ধতা',
    text_en: 'Direct riverine inundation, flash-flood forecasting, and monsoon water table modeling are strictly outside the MVP scope and must be verified locally in flood-prone basin zones.',
    text_bn: 'সরাসরি নদীর পানি বৃদ্ধি, আকস্মিক বন্যা এবং বর্ষার জলাবদ্ধতা মডেলিং এই প্রোটোটাইপের পরিধিভুক্ত নয়; বন্যাপ্রবণ এলাকায় স্থানীয় তদারকি আবশ্যক।'
  },
  {
    id: 'crop_data_prototype',
    number: 5,
    title_en: 'Crop Trait Prototype Note',
    title_bn: 'ফসল বৈশিষ্ট্য প্রোটোটাইপ নোট',
    text_en: 'Agronomic crop parameters (growing days, water demand, heat tolerance, pH boundaries) are calibrated prototype values derived from BARI/BRRI published literature and should be reviewed by regional upazila extension officers.',
    text_bn: 'ফসলের জীবনকাল, পানির চাহিদা, তাপমাত্রা সহনশীলতা ও পিএইচ সীমার মানসমূহ বারি ও ব্রি-এর প্রকাশিত গবেষণার ওপর ভিত্তি করে তৈরি, যা মাঠ পর্যায়ের কর্মকর্তার সাথে যাচাইযোগ্য।'
  },
  {
    id: 'baseline_autocorrelation',
    number: 6,
    title_en: 'Baseline Autocorrelation Notice',
    title_bn: 'ঐতিহাসিক বেসলাইন স্বয়ংক্রিয়-সহসম্পর্ক সতর্কতা',
    text_en: 'Historical baseline statistics (mean and standard deviation) are derived from 2019–2023 satellite observations centered around DOY 59 ± 7 days; adjacent DOY baseline windows exhibit statistical autocorrelation.',
    text_bn: '২০১৯–২০২৩ সালের উপগ্রহ তথ্য থেকে নির্ধারিত বেসলাইন পরিসংখ্যান (DOY ৫৯ ± ৭ দিন) সংলগ্ন দিনের ক্ষেত্রে পরিসংখ্যানগতভাবে স্বয়ংক্রিয়-সহসম্পর্কযুক্ত হতে পারে।'
  },
  {
    id: 'gpm_latency_class',
    number: 7,
    title_en: 'GPM Precipitation Latency Class Disclosure',
    title_bn: 'GPM বৃষ্টিপাত ডেটা লেটেন্সি সংক্রান্ত ঘোষণা',
    text_en: "This demo analysis uses the Final (gauge-corrected) GPM product (GPM_3IMERGDF.07), the most accurate available for the Feb 2024 period. A live/current-date query would need to use Early or Late Run data because Final publishes ~3.5 months after the fact.",
    text_bn: "এই প্রদর্শনীতে ২০২৪ সালের ফেব্রুয়ারি পর্যবেক্ষণ সময়কালের জন্য সর্বোচ্চ নির্ভুলতার ফাইনাল (গ্রাউন্ড-গেজ সমন্বিত) GPM ডেটা ব্যবহৃত হয়েছে। বাস্তব সময়ে বা বর্তমান তারিখের পর্যবেক্ষণে ফাইনাল ডেটার ~৩.৫ মাস প্রকাশনা বিলম্বের কারণে আর্লি বা লেট রান ডেটা ব্যবহারের প্রয়োজন হবে।"
  }
];

export function t(key, lang = 'en') {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

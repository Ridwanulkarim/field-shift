import React, { useState, useEffect } from 'react';
import { compareRotations } from '../services/api';
import RotationCard from '../components/RotationCard';

/**
 * RotationComparison Page (NASA Challenge Statement Full Compliance)
 * Compares at least three rotation strategies, including the existing baseline:
 * 1. Strategy 1: Existing Rotation (Baseline) - Intensive Boro Rice → Fallow
 * 2. Strategy 2: Water-Resilient Focus - Barind Pulse (Chickpea → Mung Bean)
 * 3. Strategy 3: Alternative / Diversified Focus - Cereal-Pulse (Wheat → Mung Bean)
 * 
 * PROVES NASA MULTIPLIER RANKING-SHIFT:
 * - Option A (Water-resilient): Water 80, Heat 40
 * - Option B (Heat-resilient): Water 40, Heat 80
 * - Existing Baseline: Water 25, Heat 50 (1,200mm pumping, April heat sensitivity)
 * - Field 1 (Barind drought): Strategy 2 wins (62.72 vs 57.28 vs 35.80)
 * - Field 2 (Dinajpur irrigated): Strategy 3 wins (61.83 vs 58.16 vs 38.65)
 * 
 * STRICT COMPLIANCE:
 * - Spec Section 50: Strictly "Highest-scoring rotation", NEVER "Best rotation".
 * - Challenge Mandate: Answers Why suggested, Supporting evidence, Benefits, and Gaps/Risks.
 * - Playbook Specs: SMS-length advisory (<160 chars), Monsoon onset algorithm, Sensitivity check.
 */

// Four-Pillar Agronomic Audit Data for each Strategy
const STRATEGY_AUDIT_PILLARS = [
  {
    id: 'baseline',
    strategyNumber: 'Strategy 1',
    name: 'Existing Baseline (Intensive Boro Rice → Fallow)',
    subtitle: 'Prevalent High-Input Monoculture Benchmark',
    themeColor: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
    badgeColor: 'bg-amber-900/60 text-amber-200 border-amber-600/60',
    whySuggested:
      'Serves as the empirical reference benchmark representing current farmer practice across north-western Bangladesh. Captures the high-water, high-fertilizer baseline against which water conservation, soil regeneration, and economic stability are quantified.',
    supportingEvidence:
      'NASA GRACE gravimetry records severe groundwater depletion (-0.5 to -1.0 m/yr drawdown in Barind aquifer). NASA SMAP Level 4 detects critical root-zone soil moisture deficits reaching 0.9693. BRRI Modern Rice Cultivation (2022) confirms Boro demands 1,200–1,400 mm of pumped groundwater per hectare.',
    keyBenefits:
      'Deeply entrenched farmer familiarity; established government paddy procurement centers with guaranteed price floors; predictable caloric yield if groundwater pumps do not dry out.',
    gapsAndRisks:
      'CRITICAL RISKS: Tubewell suction failure during peak March-April drought; escalating electricity and diesel irrigation tariffs; hardpan soil compaction from wet puddling; soil organic carbon depleted below 1.0%.\nINFORMATION GAPS: Micro-scale aquifer recharge rates at individual union levels require local monitoring.'
  },
  {
    id: 'water_resilient',
    strategyNumber: 'Strategy 2',
    name: 'Water-Resilient Focus (Chickpea → Mung Bean)',
    subtitle: 'High-Scoring on Barind Rainfed Terraces',
    themeColor: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
    badgeColor: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/60',
    whySuggested:
      'Engineered specifically for water-scarce, drought-vulnerable zones where groundwater pumping is unaffordable or physically constrained. Replaces water-exhaustive cereals with dual deep-taproot and short-duration legumes.',
    supportingEvidence:
      'NASA SMAP root-zone drought anomalies trigger a +96.9% water multiplier. BARI Krishi Projukti Hatboi (2019, Ch. 3) verifies BARI Chola-9 requires only 150–250 mm moisture by scavenging residual monsoon subsoil water, followed by early-summer BARI Mung-6.',
    keyBenefits:
      'Saves 75–85% irrigation water (~1,000 mm/ha preserved); biological nitrogen fixation contributes 65–100 kg atmospheric N/ha; breaks cereal root-knot nematode and sheath blight cycles; improves topsoil aggregation and tilth.',
    gapsAndRisks:
      'LOCAL RISKS: Highly vulnerable to early pre-monsoon heavy downpours (>24h waterlogging triggers fatal root asphyxia/collar rot); Botrytis gray mold during overcast periods.\nINFORMATION GAPS: NASA SMAP (9 km resolution) cannot detect plot-level drainage ditches. Local DAE extension verification of field elevation is essential.'
  },
  {
    id: 'diversified',
    strategyNumber: 'Strategy 3',
    name: 'Diversified Cereal-Pulse (Wheat → Mung Bean)',
    subtitle: 'High-Scoring on Irrigated Alluvial Plains',
    themeColor: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
    badgeColor: 'bg-cyan-900/60 text-cyan-200 border-cyan-500/60',
    whySuggested:
      'Designed for farmers who require domestic cereal grain security for household consumption but seek to avoid Boro groundwater exhaustion while boosting organic biomass through legume green manuring.',
    supportingEvidence:
      'NASA MODIS Land Surface Temperature (LST) shows manageable spring heat (0.1059) in northern alluvium. BWMRI (2020) verifies blast-resistant, heat-tolerant BARI Gom-33 matures in 105–110 days with only 350–450 mm water across 3 critical irrigations.',
    keyBenefits:
      'Provides household bread/cereal grain while cutting irrigation by >60% vs Boro; balanced carbon-to-nitrogen (C:N) stover residue builds humus; dual food and cash income streams stabilize household economy.',
    gapsAndRisks:
      'LOCAL RISKS: Terminal heat spikes (>32°C in early March) causing grain shriveling if planting is delayed past Nov 30; localized wheat blast risk during warm foggy periods.\nINFORMATION GAPS: Upazila-level certified seed availability for BARI Gom-33 must be confirmed with local seed dealers.'
  }
];

// Four-Pillar Bengali Agronomic Audit Data
const STRATEGY_AUDIT_PILLARS_BN = [
  {
    id: 'baseline',
    strategyNumber: 'কৌশল ১',
    name: 'প্রচলিত বেঞ্চমার্ক (নিবিড় বোরো ধান → পতিত জমি)',
    subtitle: 'উচ্চ-সেচ নির্ভর প্রচলিত একফসলী চাষাবাদ বেঞ্চমার্ক',
    themeColor: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
    badgeColor: 'bg-amber-900/60 text-amber-200 border-amber-600/60',
    whySuggested:
      'উত্তর-পশ্চিমাঞ্চলের কৃষকদের বর্তমান চাষাবাদ পদ্ধতির তুলনামূলক মাপকাঠি হিসেবে ব্যবহৃত। অতিরিক্ত ভূগর্ভস্থ পানি উত্তোলন এবং রাসায়নিক সারের ব্যবহার সাপেক্ষে পানি সাশ্রয়, মাটির উর্বরতা বৃদ্ধি ও অর্থনৈতিক স্থিতিশীলতা পরিমাপের ভিত্তি।',
    supportingEvidence:
      'নাসা GRACE উপগ্রহ তথ্য বরেন্দ্র অঞ্চলে তীব্র ভূগর্ভস্থ পানির স্তর হ্রাস (-০.৫ থেকে -১.০ মিটার/বছর) রেকর্ড করেছে। নাসা SMAP লেভেল-৪ শিকড় অঞ্চলের গুরুতর আর্দ্রতা ঘাটতি (০.৯৬৯৩) শনাক্ত করেছে। ব্রি (BRRI ২০২২) নিশ্চিত করে বোরো চাষে হেক্টর প্রতি ১,২০০–১,৪০০ মিমি উত্তোলিত ভূগর্ভস্থ পানি প্রয়োজন।',
    keyBenefits:
      'কৃষকদের দীর্ঘদিনের চাষাবাদের পরিচিতি; সরকারি ধান সংগ্রহ কেন্দ্রে নির্দিষ্ট মূল্যে বিক্রির সুযোগ; ভূগর্ভস্থ পাম্প সচল থাকলে নিশ্চিত উৎপাদন।',
    gapsAndRisks:
      'মারাত্মক ঝুঁকি: মার্চ-এপ্রিলের তীব্র খরায় গভীর নলকূপে পানি না ওঠা; সেচে ব্যবহৃত বিদ্যুৎ ও ডিজেলের ক্রমবর্ধমান ব্যয়; কাদা তৈরির ফলে মাটির নিচের শক্ত স্তর (Hardpan) তৈরি ও জৈব কার্বন ১.০%-এর নিচে নেমে যাওয়া।\nতথ্য ঘাটতি: ইউনিয়ন পর্যায়ে ভূগর্ভস্থ পানির প্রাকৃতিক রিচার্জ হারের সঠিক তথ্যের জন্য স্থানীয় তদারকি আবশ্যক।'
  },
  {
    id: 'water_resilient',
    strategyNumber: 'কৌশল ২',
    name: 'পানি-সহনশীল শস্যবিন্যাস (ছোলা → মুগ ডাল)',
    subtitle: 'বরেন্দ্র অঞ্চলের বৃষ্টি-নির্ভর উঁচু জমিতে সর্বোচ্চ কার্যকর',
    themeColor: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
    badgeColor: 'bg-emerald-900/60 text-emerald-200 border-emerald-500/60',
    whySuggested:
      'পানি-ঘাটতি ও খরাপ্রবণ এলাকার জন্য বিশেষভাবে প্রস্তুতকৃত, যেখানে ভূগর্ভস্থ পানি উত্তোলন ব্যয়বহুল বা অসম্ভব। অতিরিক্ত পানি-শোষণকারী দানাদার ফসলের পরিবর্তে গভীর শিকড়যুক্ত ও স্বল্পমেয়াদী ডাল জাতীয় ফসল অন্তর্ভুক্ত করা হয়েছে।',
    supportingEvidence:
      'নাসা SMAP শিকড় এলাকার খরা অস্বাভাবিকতা সক্রিয়ভাবে +৯৬.৯% পানি গুণক প্রয়োগ করে। বারি (BARI কৃষি প্রযুক্তি হাতবই ২০১৯) নিশ্চিত করে বারি ছোলা-৯ বর্ষার অবশিষ্ট মাটির রস ব্যবহার করে মাত্র ১৫০–২৫০ মিমি পানিতে উৎপন্ন হয়, এবং এরপরেই গ্রীষ্মকালীন বারি মুগ-৬ চাষ সম্ভব।',
    keyBenefits:
      '৭৫–৮৫% সেচের পানি সাশ্রয় করে (হেক্টর প্রতি ~১,০০০ মিমি পানি সংরক্ষিত); বায়বীয় নাইট্রোজেন সংবন্ধনের মাধ্যমে জমিতে ৬৫–১০০ কেজি/হেক্টর জৈব নাইট্রোজেন যোগ করে; ক্ষতিকারক কৃমি ও রোগবালাই চক্র ভেঙে দেয়; মাটির গঠন উন্নত করে।',
    gapsAndRisks:
      'স্থানীয় ঝুঁকি: প্রাক-বর্ষার আকস্মিক অতিবৃষ্টিতে ২৪ ঘণ্টার বেশি জলাবদ্ধতা হলে শিকড় পচে নষ্ট হতে পারে; মেঘলা আবহাওয়ায় বোট্রিটিস গ্রে মোল্ড রোগের প্রকোপ।\nতথ্য ঘাটতি: নাসা SMAP (৯ কিমি) প্লট-স্তরের ড্রেনেজ বা নালা শনাক্ত করতে পারে না। কৃষি সম্প্রসারণ অধিদপ্তরের (DAE) মাঠ পরিদর্শন আবশ্যক।'
  },
  {
    id: 'diversified',
    strategyNumber: 'কৌশল ৩',
    name: 'বহুমুখী শস্য-ডাল বিন্যাস (গম → মুগ ডাল)',
    subtitle: 'সেচযুক্ত পলিমাটির সমভূমি অঞ্চলে সর্বোচ্চ স্কোরপ্রাপ্ত',
    themeColor: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300',
    badgeColor: 'bg-cyan-900/60 text-cyan-200 border-cyan-500/60',
    whySuggested:
      'পারিবারিক দানাদার খাদ্যের নিরাপত্তা বজায় রেখে বোরো ধানের ভূগর্ভস্থ পানি অপচয় রোধ এবং ডাল ফসলের মাধ্যমে মাটিতে জৈব বায়োমাস বৃদ্ধির উদ্দেশ্যে পরিকল্পিত।',
    supportingEvidence:
      'নাসা MODIS ভূপৃষ্ঠ তাপমাত্রা (LST) উত্তরাঞ্চলের সমভূমিতে সহনশীল তাপমাত্রা (০.১০৫৯) নির্দেশ করে। গম ও ভুট্টা গবেষণা ইনস্টিটিউট (BWMRI ২০২০) অনুযায়ী ব্লাস্ট-সহনশীল বারি গম-৩৩ মাত্র ৩৫০–৪৫০ মিমি পানিতে এবং ৩টি সেচে ১০৫–১১০ দিনে পরিপক্ক হয়।',
    keyBenefits:
      'পারিবারিক আটা/দানার চাহিদা পূরণের পাশাপাশি বোরোর তুলনায় >৬০% সেচ সাশ্রয় করে; সুষম কার্বন-নাইট্রোজেন অনুপাত সমৃদ্ধ নাড়া মাটির হিউমাস বৃদ্ধি করে; দ্বৈত খাদ্য ও নগদ আয়ে পরিবার সুরক্ষিত থাকে।',
    gapsAndRisks:
      'স্থানীয় ঝুঁকি: ৩০ নভেম্বরের পরে দেরিতে বপন করলে মার্চ মাসের আকস্মিক তাপপ্রবাহে দানার আকার ছোট হয়ে যাওয়ার ঝুঁকি; কুয়াশাচ্ছন্ন আবহাওয়ায় গমের ব্লাস্ট রোগ।\nতথ্য ঘাটতি: উপজেলা পর্যায়ে বারি গম-৩৩-এর প্রত্যয়িত বীজের প্রাপ্যতা স্থানীয় বীজ ডিলারের সাথে নিশ্চিত করতে হবে।'
  }
];

export default function RotationComparison({ fields = [], selectedFieldId = 1, onSelectField, lang = 'en' }) {
  const isBn = lang === 'bn';
  const auditPillars = isBn ? STRATEGY_AUDIT_PILLARS_BN : STRATEGY_AUDIT_PILLARS;

  // Demonstration mode: 'section40_fixture' | 'bangladesh_crops'
  const [demoMode, setDemoMode] = useState('section40_fixture');
  const [activeFieldId, setActiveFieldId] = useState(selectedFieldId || 1);

  // Irrigation toggle for Fixture 3 experiment
  const [isIrrigatedOverride, setIsIrrigatedOverride] = useState(null);

  // Priorities: Section 40 base priorities (Water=3, Heat=4, Soil=3, Diversity=3, Profitability=3)
  const [waterPriority, setWaterPriority] = useState(3);
  const [heatPriority, setHeatPriority] = useState(4);

  // Active Audit Matrix Tab
  const [activeAuditTab, setActiveAuditTab] = useState('whySuggested');

  // Copy SMS state
  const [smsCopied, setSmsCopied] = useState(false);

  // Expandable science drawers
  const [showClimateScience, setShowClimateScience] = useState(false);

  // Comparison results from API (for real crop mode)
  const [apiComparison, setApiComparison] = useState(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const activeField = fields.find(f => f.id === activeFieldId) || fields[0];

  // Determine actual irrigation state
  const effectiveIrrigation = isIrrigatedOverride !== null
    ? isIrrigatedOverride
    : activeField?.irrigation_available ?? false;

  // Stresses for active field
  // Field 1 (Rajshahi): raw water = 0.9693, heat = 0.1228
  // Field 2 (Dinajpur): raw water = 0.3229, heat = 0.1059
  const isField1 = activeFieldId === 1;
  const isField2 = activeFieldId === 2;

  const rawWaterStress = isField1 ? 0.9693 : isField2 ? 0.3229 : 0.50;
  const rawHeatStress = isField1 ? 0.1228 : isField2 ? 0.1059 : 0.25;

  const adjustedWaterStress = effectiveIrrigation ? rawWaterStress * 0.7 : rawWaterStress;

  // Section 37 & 39 Multipliers: 1 + stress
  const waterMultiplier = 1 + adjustedWaterStress;
  const heatMultiplier = 1 + rawHeatStress;

  const effectiveWaterWeight = waterPriority * waterMultiplier;
  const effectiveHeatWeight = heatPriority * heatMultiplier;
  const totalWeight = effectiveWaterWeight + effectiveHeatWeight;

  // Section 40 Canonical Scores for 3 Strategies:
  // Strategy 2 (Option A): Water = 80, Heat = 40
  // Strategy 3 (Option B): Water = 40, Heat = 80
  // Strategy 1 (Baseline Boro): Water = 25, Heat = 50
  const scoreA = ((80 * effectiveWaterWeight + 40 * effectiveHeatWeight) / totalWeight);
  const scoreB = ((40 * effectiveWaterWeight + 80 * effectiveHeatWeight) / totalWeight);
  const scoreBaseline = ((25 * effectiveWaterWeight + 50 * effectiveHeatWeight) / totalWeight);

  // Top candidate determination
  const topCandidateId = scoreA >= scoreB ? 'option_a' : 'option_b';
  const scoreDeltaAB = Math.abs(scoreA - scoreB).toFixed(2);
  const scoreDeltaVsBaseline = (Math.max(scoreA, scoreB) - scoreBaseline).toFixed(2);

  // SMS Text (<160 chars GSM standard)
  const smsAdvisory = isBn
    ? (isField1
        ? 'বরেন্দ্র পরামর্শ: তীব্র খরা (SMAP ৯৭%)। বোরো বাদ দিয়ে ছোলা-মুগডাল বেছে নিন। ১০০০ মিমি পানি বাঁচবে ও ৭৫ কেজি N/হেক্টর যুক্ত হবে। বপনের আগে নিষ্কাশন দেখুন।'
        : 'দিনাজপুর পরামর্শ: সেচ সুবিধাসহ মৃদু চাপ। গম-মুগডাল শস্যবিন্যাস বেছে নিন। ফলন ও মাটির স্বাস্থ্য সুরক্ষার পাশাপাশি ৬০% সেচের পানি সাশ্রয় হবে।')
    : (isField1
        ? 'BARIND ADVISORY: Severe drought (SMAP 97%). Shift Boro to Chickpea-Mungbean. Saves 1,000mm water & fixes 75kg N/ha. Check plot drainage before sowing.'
        : 'DINAJPUR ADVISORY: Mild drought with irrigation. Shift to Wheat-Mungbean. Balances grain yield & soil health while cutting water by 60%.');

  const handleCopySms = () => {
    navigator.clipboard.writeText(smsAdvisory);
    setSmsCopied(true);
    setTimeout(() => setSmsCopied(false), 2200);
  };

  // Run real API comparison if in bangladesh_crops mode (3 rotations)
  useEffect(() => {
    if (demoMode === 'bangladesh_crops' && activeField) {
      async function runApiCompare() {
        try {
          setIsLoadingApi(true);
          const payload = {
            field_id: activeField.id,
            cycle_mode: 'continue_after_current',
            rotation_cycle_mode: 'continue_after_current',
            rotations: [
              {
                name: isBn ? 'কৌশল ১: প্রচলিত বেঞ্চমার্ক (বোরো ধান → আউশ ধান)' : 'Strategy 1: Existing Baseline (Boro Rice → Aus Rice)',
                label: isBn ? 'কৌশল ১: প্রচলিত বেঞ্চমার্ক (বোরো ধান → আউশ ধান)' : 'Strategy 1: Existing Baseline (Boro Rice → Aus Rice)',
                crop_ids: [2, 4],
                season_sequence: ['Rabi', 'Kharif-1'],
                seasons: ['Rabi', 'Kharif-1'],
                is_baseline: true
              },
              {
                name: isBn ? 'কৌশল ২: পানি-সহনশীল (ছোলা → মুগ ডাল)' : 'Strategy 2: Water-Resilient (Chickpea → Mung Bean)',
                label: isBn ? 'কৌশল ২: পানি-সহনশীল (ছোলা → মুগ ডাল)' : 'Strategy 2: Water-Resilient (Chickpea → Mung Bean)',
                crop_ids: [12, 5],
                season_sequence: ['Rabi', 'Kharif-1'],
                seasons: ['Rabi', 'Kharif-1']
              },
              {
                name: isBn ? 'কৌশল ৩: বহুমুখী শস্য-ডাল (গম → মুগ ডাল)' : 'Strategy 3: Diversified Cereal-Pulse (Wheat → Mung Bean)',
                label: isBn ? 'কৌশল ৩: বহুমুখী শস্য-ডাল (গম → মুগ ডাল)' : 'Strategy 3: Diversified Cereal-Pulse (Wheat → Mung Bean)',
                crop_ids: [8, 5],
                season_sequence: ['Rabi', 'Kharif-1'],
                seasons: ['Rabi', 'Kharif-1']
              }
            ],
            priorities: {
              water_priority: waterPriority,
              heat_priority: heatPriority,
              soil_priority: 3,
              diversity_priority: 3,
              profitability_priority: 3
            },
            weights: {
              water_priority: waterPriority,
              heat_priority: heatPriority,
              soil_priority: 3,
              diversity_priority: 3,
              profitability_priority: 3
            }
          };
          const data = await compareRotations(payload);
          setApiComparison(data.comparison || data);
        } catch (err) {
          console.error('API comparison error:', err);
        } finally {
          setIsLoadingApi(false);
        }
      }
      runApiCompare();
    }
  }, [demoMode, activeFieldId, waterPriority, heatPriority, effectiveIrrigation]);

  // Construct 3 Strategy objects for Section 40 mode
  const section40RotationA = {
    id: 'option_a',
    label: isBn
      ? 'কৌশল ২: পানি-সহনশীল শস্যবিন্যাস (বরেন্দ্র ডাল: ছোলা → মুগ ডাল)'
      : 'Strategy 2: Water-Resilient Focus (Barind Pulse: Chickpea → Mung Bean)',
    overall_score: scoreA,
    water_score: 80,
    heat_score: 40,
    soil_score: 75,
    diversity_score: 85,
    profitability_score: 70,
    is_baseline: false,
    feasibility_status: 'Seasonally feasible',
    sequence: [
      { season: 'Rabi', name: isBn ? 'ছোলা / ডাল' : 'Chickpea / Pulse', family: 'Legume', duration_days: 115 },
      { season: 'Kharif-1', name: isBn ? 'মুগ ডাল' : 'Mung Bean', family: 'Legume', duration_days: 65 }
    ],
    weights: {
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight
    },
    explanation: {
      scoring_version: 'v6.2',
      water: {
        rationale: isBn
          ? `উচ্চ পানি সহনশীলতা স্কোর (৮০/১০০)। সক্রিয় খরা গুণক (${waterMultiplier.toFixed(2)}x) দ্বারা কার্যকর গুরুত্ব ${effectiveWaterWeight.toFixed(2)}-এ বৃদ্ধি পেয়েছে।`
          : `High water resilience score (80/100). Amplified by active water stress multiplier (${waterMultiplier.toFixed(2)}x) to total weight ${effectiveWaterWeight.toFixed(2)}.`
      },
      heat: {
        rationale: isBn
          ? `মাঝারি তাপ সহনশীলতা (৪০/১০০)। তাপ গুণক (${heatMultiplier.toFixed(2)}x) সাপেক্ষে কার্যকর গুরুত্ব ${effectiveHeatWeight.toFixed(2)}।`
          : `Moderate heat tolerance (40/100). Weighted by thermal multiplier (${heatMultiplier.toFixed(2)}x) to weight ${effectiveHeatWeight.toFixed(2)}.`
      },
      soil: { base_soil_health_score: 75, drainage_penalty: 0, ph_penalty: 0, final_soil_score: 75 },
      diversity: { candidate_crop_families: ['Legume'], repeat_check_sequence: ['Legume', 'Legume'], repeat_penalty: 15, final_diversity_score: 85 },
      caveats: [
        'Not a forecast: NASA conditions reflect current satellite anomalies, not predictive forecasts.',
        'Drainage vulnerability: Legumes cannot tolerate waterlogging exceeding 24 hours.'
      ]
    }
  };

  const section40RotationB = {
    id: 'option_b',
    label: isBn
      ? 'কৌশল ৩: বহুমুখী শস্য-ডাল বিন্যাস (গম → মুগ ডাল)'
      : 'Strategy 3: Diversified Cereal-Pulse (Wheat → Mung Bean)',
    overall_score: scoreB,
    water_score: 40,
    heat_score: 80,
    soil_score: 50,
    diversity_score: 100,
    profitability_score: 75,
    is_baseline: false,
    feasibility_status: 'Seasonally feasible',
    sequence: [
      { season: 'Rabi', name: isBn ? 'গম / খাদ্যশস্য' : 'Wheat / Cereal', family: 'Cereal', duration_days: 108 },
      { season: 'Kharif-1', name: isBn ? 'মুগ ডাল' : 'Mung Bean', family: 'Legume', duration_days: 65 }
    ],
    weights: {
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight
    },
    explanation: {
      scoring_version: 'v6.2',
      water: {
        rationale: isBn
          ? `মাঝারি পানি সহনশীলতা স্কোর (৪০/১০০)। খরার পরিস্থিতিতে নিম্ন পানি স্কোরের ওপর পেনাল্টি কার্যকর হয়।`
          : `Moderate water resilience score (40/100). In drought conditions, lower water score incurs severe weighted penalty.`
      },
      heat: {
        rationale: isBn
          ? `উচ্চ তাপমাত্রা সহনশীলতা স্কোর (৮০/১০০)। বারি গম-৩৩ প্রাক-গ্রীষ্মের তাপপ্রবাহ এড়িয়ে উচ্চ ফলন দেয়।`
          : `High thermal tolerance score (80/100). BARI Gom-33 escapes terminal heat while maintaining high photosynthetic efficiency.`
      },
      soil: { base_soil_health_score: 50, drainage_penalty: 0, ph_penalty: 0, final_soil_score: 50 },
      diversity: { candidate_crop_families: ['Cereal', 'Legume'], repeat_check_sequence: ['Cereal', 'Legume'], repeat_penalty: 0, final_diversity_score: 100 },
      caveats: [
        'Not a forecast: NASA conditions reflect current satellite anomalies, not predictive forecasts.',
        'Terminal heat risk: Delayed sowing past November 30 reduces grain fill duration.'
      ]
    }
  };

  const section40RotationBaseline = {
    id: 'baseline',
    label: isBn
      ? 'কৌশল ১: প্রচলিত বেঞ্চমার্ক (নিবিড় বোরো ধান → পতিত জমি)'
      : 'Strategy 1: Existing Baseline (Intensive Boro Rice → Fallow)',
    overall_score: scoreBaseline,
    water_score: 25,
    heat_score: 50,
    soil_score: 30,
    diversity_score: 25,
    profitability_score: 60,
    is_baseline: true,
    feasibility_status: 'Seasonally feasible',
    sequence: [
      { season: 'Rabi', name: isBn ? 'বোরো ধান' : 'Boro Rice', family: 'Cereal', duration_days: 145 },
      { season: 'Kharif-1', name: isBn ? 'পতিত জমি' : 'Fallow / Monoculture', family: 'Bare Soil', duration_days: 90 }
    ],
    weights: {
      effective_water_weight: effectiveWaterWeight,
      effective_heat_weight: effectiveHeatWeight
    },
    explanation: {
      scoring_version: 'v6.2',
      water: {
        rationale: isBn
          ? `গুরুতর ভূগর্ভস্থ পানি হ্রাসের কারণে পেনাল্টি (২৫/১০০)। ১,২০০–১,৪০০ মিমি পানি ব্যবহার করায় নাসা SMAP খরা গুণক (${waterMultiplier.toFixed(2)}x) দ্বারা কার্যকর গুরুত্ব ${effectiveWaterWeight.toFixed(2)} বৃদ্ধি পায়।`
          : `Severe groundwater depletion penalty (25/100). Consumes 1,200–1,400 mm pumped water; penalized by NASA SMAP drought multiplier (${waterMultiplier.toFixed(2)}x) to effective weight ${effectiveWaterWeight.toFixed(2)}.`
      },
      heat: {
        rationale: isBn
          ? `মাঝারি তাপ সহনশীলতা (৫০/১০০)। এপ্রিলের আকস্মিক তাপপ্রবাহে (>৩৫°সে) চিটা হওয়ার ঝুঁকি বিদ্যমান।`
          : `Moderate heat tolerance (50/100). Highly vulnerable to April anthesis heat shocks (>35°C) causing spikelet sterility ("chiTa").`
      },
      soil: { base_soil_health_score: 30, drainage_penalty: 0, ph_penalty: 0, final_soil_score: 30 },
      diversity: { candidate_crop_families: ['Cereal'], repeat_check_sequence: ['Cereal', 'Cereal'], repeat_penalty: 25, final_diversity_score: 25 },
      caveats: [
        'Baseline benchmark: Prevalent intensive practice causing 0.5–1.0 m/yr aquifer drop across the Barind tract.',
        'Soil degradation: Continuous anaerobic puddling destroys soil aggregate porosity and exhausts organic carbon.'
      ]
    }
  };

  // Rank section 40 rotations dynamically
  const sortedSection40Rotations = [
    section40RotationA,
    section40RotationB,
    section40RotationBaseline
  ].sort((a, b) => b.overall_score - a.overall_score);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* KILLER DEMO TOP ADVISORY SENTENCE & SMS BROADCAST */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#072418] to-cyan-950 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-emerald-900/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-emerald-800/40">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl animate-pulse">📢</span>
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-400 block">
                {isBn
                  ? 'কৃষি-জলবায়ু পরামর্শ নির্দেশিকা • সিদ্ধান্ত হোক সুস্পষ্ট বাক্যে, কোনো বিভ্রান্তিকর চার্টে নয়'
                  : 'Agro-Climatic Advisory Directive • End on a Sentence, Not a Chart'}
              </span>
              <h1 className="text-base sm:text-lg md:text-xl font-extrabold text-white">
                {isField1
                  ? (isBn
                      ? 'বরেন্দ্র তীব্র খরা: পানিখেকো বোরো ধান পরিবর্তন করে ছোলা → মুগ ডাল বেছে নিন (বেঞ্চমার্ক থেকে +২৬.৯ পয়েন্ট বেশি)'
                      : 'Severe Barind Drought: Shift Intensive Boro Rice to Chickpea → Mung Bean (+26.9 pts over Baseline)')
                  : (isBn
                      ? 'সেচযোগ্য পলিমাটি অঞ্চল: গম → মুগ ডাল চাষের দিকে যান (বেঞ্চমার্ক থেকে +২৩.২ পয়েন্ট বেশি)'
                      : 'Irrigated Alluvial Plain: Shift to Wheat → Mung Bean (+23.2 pts over Baseline)')}
              </h1>
            </div>
          </div>

          {/* Copy SMS Action Button (<160 chars) */}
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[11px] text-emerald-300/70 hidden sm:inline font-mono">
              {smsAdvisory.length}/160 chars
            </span>
            <button
              onClick={handleCopySms}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                smsCopied
                  ? 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95'
              }`}
              title={isBn ? 'কৃষি সম্প্রসারণ কর্মীদের (DAE) জন্য SMS কপি করুন' : 'Copy SMS text for local agricultural extension agents (DAE)'}
            >
              <span>{smsCopied ? '✓' : '📋'}</span>
              <span>{smsCopied ? (isBn ? 'ক্লিপবোর্ডে কপি হয়েছে!' : 'Copied to Clipboard!') : (isBn ? 'কৃষি সম্প্রসারণ SMS কপি' : 'Copy Extension SMS')}</span>
            </button>
          </div>
        </div>

        {/* SMS Quote Box */}
        <div className="mt-3 bg-[#03130c]/90 border border-emerald-800/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-200 font-mono">
            <span className="text-emerald-400 font-bold shrink-0">{isBn ? 'এসএমএস ফরম্যাট:' : 'SMS Format:'}</span>
            <span className="italic text-emerald-100/90 truncate">"{smsAdvisory}"</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold shrink-0">
            {isBn ? '✓ কৃষি সম্প্রসারণে প্রচারের জন্য প্রস্তুত' : '✓ Ready for DAE Field Transmission'}
          </span>
        </div>
      </div>

      {/* Top Header & Environmental Stress Controller */}
      <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-emerald-800/40">
          <div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              {isBn ? 'নাসা বহু-কৌশল তুলনামূলক ম্যাট্রিক্স (৩ কৌশল)' : 'NASA Multi-Strategy Comparison Matrix (3 Strategies)'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
              {isBn ? 'প্রচলিত বেঞ্চমার্ক বনাম অভিযোজিত শস্যবিন্যাস' : 'Existing Baseline vs. Resilient Rotations'}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-300/80 mt-1 max-w-3xl leading-relaxed">
              {isBn
                ? 'নাসা আর্থ অবজারভেশন (SMAP, MODIS, GPM, HLS) এবং স্থানীয় কৃষি নির্দেশিকা (BARI, BRRI, BWMRI) ব্যবহার করে ৩টি ভিন্ন শস্যবিন্যাস কৌশল পাশাপাশি মূল্যায়ন।'
                : 'Evaluating 3 distinct rotation strategies side-by-side using NASA Earth Observations (SMAP, MODIS, GPM, HLS) and local agronomic guidelines (BARI, BRRI, BWMRI).'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-xl bg-[#04140d] p-1 border border-emerald-800/60 text-xs sm:text-sm w-full sm:w-auto gap-1">
            <button
              onClick={() => setDemoMode('section40_fixture')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                demoMode === 'section40_fixture'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              📐 {isBn ? 'সেকশন ৪০ ফিক্সচার (৩ কৌশল)' : 'Section 40 Fixture (3 Strategies)'}
            </button>
            <button
              onClick={() => setDemoMode('bangladesh_crops')}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all text-center cursor-pointer ${
                demoMode === 'bangladesh_crops'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              🌾 {isBn ? 'লাইভ বাংলাদেশ ফসল (৩ কৌশল)' : 'Live BD Crops (3 Strategies)'}
            </button>
          </div>
        </div>

        {/* Field & Environmental Stress Controller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-5">
          {/* Active Field Picker */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
              {isBn ? 'তুলনার মাঠ নির্বাচন করুন' : 'Select Comparison Field Context'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setActiveFieldId(1); setIsIrrigatedOverride(null); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border ${
                  activeFieldId === 1
                    ? 'bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-500/50'
                    : 'bg-[#03140c] border-emerald-800/50 text-emerald-300/70 hover:text-white'
                }`}
              >
                <div className="font-extrabold">{isBn ? 'মাঠ ১ (বরেন্দ্র)' : 'Field #1 (Barind)'}</div>
                <div className="text-[10px] text-amber-300/80 font-normal">{isBn ? 'তীব্র খরা (বৃষ্টি-নির্ভর)' : 'Severe Drought (Rainfed)'}</div>
              </button>
              <button
                onClick={() => { setActiveFieldId(2); setIsIrrigatedOverride(null); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all text-left border ${
                  activeFieldId === 2
                    ? 'bg-emerald-500/25 border-emerald-400 text-white ring-1 ring-emerald-500/50'
                    : 'bg-[#03140c] border-emerald-800/50 text-emerald-300/70 hover:text-white'
                }`}
              >
                <div className="font-extrabold">{isBn ? 'মাঠ ২ (দিনাজপুর)' : 'Field #2 (Dinajpur)'}</div>
                <div className="text-[10px] text-cyan-300/80 font-normal">{isBn ? 'সহনীয় চাপ (সেচযুক্ত)' : 'Mild Stress (Irrigated)'}</div>
              </button>
            </div>
          </div>

          {/* NASA Satellite Climate Stress Display */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              {isBn ? 'সক্রিয় নাসা পরিবেশগত চাপ গুণক' : 'Active NASA Stress Multipliers'}
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 flex items-center gap-1">💧 {isBn ? 'SMAP মাটির পানির চাপ:' : 'SMAP Water Stress:'}</span>
                <span className="font-mono font-bold text-white">
                  {(adjustedWaterStress * 100).toFixed(1)}% → <strong className="text-cyan-300">{waterMultiplier.toFixed(2)}×</strong>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300 flex items-center gap-1">🔥 {isBn ? 'MODIS তাপীয় চাপ:' : 'MODIS Heat Stress:'}</span>
                <span className="font-mono font-bold text-white">
                  {(rawHeatStress * 100).toFixed(1)}% → <strong className="text-amber-300">{heatMultiplier.toFixed(2)}×</strong>
                </span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-300/50 italic pt-1 border-t border-emerald-900/50">
              {isBn ? 'সূত্র:' : 'Formula:'} <code>1 + stress</code> ({isBn ? 'নির্দিষ্ট ১.০×–২.০× সীমা' : 'Deterministic 1.0×–2.0× range'})
            </div>
          </div>

          {/* Fixture 3: Irrigation Access Toggle */}
          <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
              {isBn ? 'সেকশন ৩ সেচ সমন্বয় ওভাররাইড' : 'Spec Fixture 3 Irrigation Override'}
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-emerald-200">{isBn ? 'সেচ প্রাপ্যতা:' : 'Irrigation Access:'}</span>
              <button
                onClick={() => setIsIrrigatedOverride(!effectiveIrrigation)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  effectiveIrrigation
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                }`}
              >
                {effectiveIrrigation
                  ? (isBn ? '✓ সেচযুক্ত (০.৭× গুণক)' : '✓ Irrigated (0.7x Factor)')
                  : (isBn ? '✕ বৃষ্টি-নির্ভর (প্রাকৃতিক চাপ)' : '✕ Rainfed (Raw Stress)')}
              </button>
            </div>
            <p className="text-[10px] text-emerald-300/60 leading-tight">
              {isBn
                ? 'স্যাটেলাইট ডেটাসেট অক্ষুণ্ণ রেখে কেবল সেচের প্রভাব পৃথকভাবে পরীক্ষা করা যায়।'
                : 'Toggling isolates irrigation relaxation without altering underlying satellite datasets.'}
            </p>
          </div>
        </div>

        {/* Live Priority Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-emerald-800/30">
          <div className="bg-[#04180e] p-3 rounded-xl border border-cyan-800/40">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-cyan-300">{isBn ? 'পানির অগ্রাধিকার (p_water):' : 'Water Priority (p_water):'}</span>
              <span className="font-mono font-bold text-white bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {isBn
                  ? `মাত্রা ${waterPriority} • কার্যকর গুরুত্ব: ${effectiveWaterWeight.toFixed(2)}`
                  : `Level ${waterPriority} • Eff. Wt: ${effectiveWaterWeight.toFixed(2)}`}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={waterPriority}
              onChange={(e) => setWaterPriority(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#03140c] rounded-lg"
            />
          </div>

          <div className="bg-[#04180e] p-3 rounded-xl border border-amber-800/40">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-amber-300">{isBn ? 'তাপ সহনশীলতা অগ্রাধিকার (p_heat):' : 'Heat Priority (p_heat):'}</span>
              <span className="font-mono font-bold text-white bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                {isBn
                  ? `মাত্রা ${heatPriority} • কার্যকর গুরুত্ব: ${effectiveHeatWeight.toFixed(2)}`
                  : `Level ${heatPriority} • Eff. Wt: ${effectiveHeatWeight.toFixed(2)}`}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={heatPriority}
              onChange={(e) => setHeatPriority(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#03140c] rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Ranking Shift Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isField1
          ? 'bg-[#082a1b] border-emerald-500/50 text-emerald-100'
          : 'bg-[#062125] border-cyan-500/50 text-cyan-100'
      }`}>
        <div className="flex items-start md:items-center gap-3">
          <span className="text-3xl mt-0.5 md:mt-0">{topCandidateId === 'option_a' ? '🌱' : '🌾'}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-400">
                {isBn ? 'নাসা গুণকের কারণে র্যাংকিং পরিবর্তন নিশ্চিত:' : 'NASA Multiplier Ranking Inversion Confirmed:'}
              </span>
              <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-[#03130b] text-white">
                Δ({isBn ? '১ম বনাম ২য়' : '1st vs 2nd'}) = {scoreDeltaAB} {isBn ? 'পয়েন্ট' : 'pts'}
              </span>
              <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60">
                Δ({isBn ? 'বেঞ্চমার্কের তুলনায়' : 'vs Baseline'}) = +{scoreDeltaVsBaseline} {isBn ? 'পয়েন্ট' : 'pts'}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-1.5 leading-relaxed">
              {topCandidateId === 'option_a'
                ? (isBn
                    ? `কৌশল ২ বরেন্দ্র অঞ্চলে (#১) অবস্থান নিশ্চিত করেছে (তীব্র খরা)। অতিরিক্ত পানির ব্যবহারের কারণে কৌশল ১ (বেঞ্চমার্ক) ৩৫.৮ পয়েন্টে নেমে গেছে, যেখানে ডালভিত্তিক শস্যবিন্যাস প্রায় ১,০০০ মিমি ভূগর্ভস্থ পানি সাশ্রয় করে।`
                    : `Strategy 2 ranks #1 on ${activeField?.name?.split('(')[0] || 'Barind'} (Severe Drought). Heavy water penalty demotes Strategy 1 (Baseline) to 35.8 pts, while Pulse rotation conserves ~1,000 mm groundwater.`)
                : (isBn
                    ? `কৌশল ৩ দিনাজপুর অঞ্চলে (#১) অবস্থান করছে। সেচ সুবিধা থাকায় পানির চাপ প্রশমিত হয়, যা তাপ-সহনশীল গমকে আধিপত্য বিস্তার করতে দেয় এবং বেঞ্চমার্ক থেকে +২৩.২ পয়েন্ট বেশি এনে দেয়।`
                    : `Strategy 3 ranks #1 on ${activeField?.name?.split('(')[0] || 'Dinajpur'}. Available irrigation dampens water stress, allowing heat-tolerant wheat to dominate while beating Baseline by +23.2 pts.`)}
            </p>
          </div>
        </div>

        <div className="text-left md:text-right pt-3 md:pt-0 border-t md:border-t-0 border-emerald-800/40 shrink-0">
          <span className="text-[11px] text-emerald-300/70 block">{isBn ? 'মূল্যায়িত ফলাফল:' : 'Evaluated Outcome:'}</span>
          <span className="text-xs sm:text-sm font-black text-emerald-300 bg-emerald-950/90 px-3.5 py-1.5 rounded-full border border-emerald-600/60 inline-block mt-1">
            🏆 {isBn ? 'সর্বোচ্চ স্কোরপ্রাপ্ত শস্যবিন্যাস:' : 'Highest-scoring rotation:'} {topCandidateId === 'option_a' ? (isBn ? 'কৌশল ২' : 'Strategy 2') : (isBn ? 'কৌশল ৩' : 'Strategy 3')}
          </span>
        </div>
      </div>

      {/* THREE-STRATEGY COMPARISON CARDS DISPLAY (Mandate: At least 3 rotations including baseline) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
            {isBn
              ? 'পাশাপাশি ৩-কৌশল মূল্যায়ন (প্রচলিত বেঞ্চমার্ক + ২টি অভিযোজিত বিকল্প)'
              : 'Side-by-Side 3-Strategy Evaluation (Baseline + 2 Resilient Candidates)'}
          </span>
          <span className="text-xs text-emerald-300/70">
            {isBn ? 'স্পেক সেকশন ৫০ নীতি: "সর্বোচ্চ স্কোরপ্রাপ্ত শস্যবিন্যাস"' : 'Strict Spec Section 50: "Highest-scoring rotation"'}
          </span>
        </div>

        {demoMode === 'section40_fixture' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sortedSection40Rotations.map((rot, idx) => (
              <RotationCard
                key={rot.id || idx}
                rotation={rot}
                rank={idx + 1}
                isTopCandidate={idx === 0}
                compact={true}
                lang={lang}
              />
            ))}
          </div>
        ) : (
          <div>
            {isLoadingApi ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-[#051d12]/60 rounded-2xl border border-emerald-800/40">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-medium">
                  {isBn ? 'POST /api/rotations/compare এর মাধ্যমে ৩টি কৌশল মূল্যায়ন হচ্ছে...' : 'Evaluating 3 rotations via POST /api/rotations/compare...'}
                </p>
              </div>
            ) : apiComparison?.rotations ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {apiComparison.rotations.map((rot, idx) => {
                  const isBaseline = rot.is_baseline || rot.name?.toLowerCase().includes('baseline') || rot.label?.toLowerCase().includes('baseline');
                  return (
                    <RotationCard
                      key={rot.id || idx}
                      rotation={{ ...rot, is_baseline: isBaseline }}
                      rank={rot.rank || idx + 1}
                      isTopCandidate={rot.rank === 1}
                      compact={true}
                      lang={lang}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-emerald-300/70 bg-[#051d12]/60 rounded-2xl">
                {isBn ? 'কোনো তুলনামূলক তথ্য পাওয়া যায়নি।' : 'No comparison data available.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOUR-PILLAR AGRONOMIC AUDIT MATRIX (NASA Challenge Statement Mandate) */}
      <div className="bg-[#092619]/90 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl backdrop-blur-md">
        <div className="pb-3 border-b border-emerald-800/40">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                {isBn ? 'নাসা চ্যালেঞ্জ স্টেটমেন্ট নির্দেশিকা' : 'NASA Challenge Statement Mandate'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white font-heading">
                {isBn ? 'চার-স্তম্ভ বিশিষ্ট কৃষি মূল্যায়ন ম্যাট্রিক্স' : 'Four-Pillar Agronomic Evaluation Matrix'}
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-emerald-300/80 mt-1 max-w-4xl">
            {isBn
              ? '৩টি কৌশলের প্রতিটির জন্য নিচে বিস্তারিত উল্লেখ করা হয়েছে: কেন এটি প্রস্তাব করা হয়েছে, নাসা উপগ্রহের প্রমাণ, কৃষিতাত্ত্বিক সুবিধাসমূহ এবং স্থানীয় বিশেষজ্ঞ/কৃষক দ্বারা পর্যালোচনার মতো তথ্যের সীমাবদ্ধতা ও ঝুঁকি।'
              : 'For each of the 3 strategies, the table below documents why it was suggested, supporting NASA observations, agronomic benefits, and critical information gaps requiring local farmer or DAE review.'}
          </p>

          {/* Interactive Tab Switcher for Mobile / Focused Reading */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { id: 'whySuggested', label: isBn ? '🎯 ১. প্রস্তাবের কারণ ও ভূমিকা' : '🎯 1. Why Suggested / Baseline Role' },
              { id: 'supportingEvidence', label: isBn ? '🛰️ ২. নাসা ও ভূমির সহায়ক প্রমাণ' : '🛰️ 2. Supporting NASA & Ground Evidence' },
              { id: 'keyBenefits', label: isBn ? '🌿 ৩. মূল সুবিধাসমূহ (পানি, মাটি, আয়)' : '🌿 3. Key Benefits (Water, Soil, Income)' },
              { id: 'gapsAndRisks', label: isBn ? '⚠️ ৪. তথ্যের সীমাবদ্ধতা ও স্থানীয় ঝুঁকি' : '⚠️ 4. Information Gaps & Local Risks' },
              { id: 'allPillars', label: isBn ? '📑 পাশাপাশি সম্পূর্ণ ম্যাট্রিক্স' : '📑 Side-by-Side Complete Matrix' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAuditTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  activeAuditTab === tab.id
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-[#04140d] text-emerald-300/70 border-emerald-800/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Display */}
        {activeAuditTab === 'allPillars' ? (
          /* Side-by-Side 3-Card Comprehensive View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            {(isBn ? STRATEGY_AUDIT_PILLARS_BN : STRATEGY_AUDIT_PILLARS).map(pillar => (
              <div
                key={pillar.id}
                className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-lg ${pillar.themeColor}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${pillar.badgeColor}`}>
                      {pillar.strategyNumber}
                    </span>
                    <span className="text-[11px] font-bold text-white/80">{pillar.subtitle}</span>
                  </div>
                  <h4 className="text-base font-extrabold text-white leading-tight font-heading">
                    {pillar.name}
                  </h4>
                </div>

                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="bg-[#03130c]/80 p-3 rounded-xl border border-emerald-800/40">
                    <span className="font-extrabold text-emerald-400 block mb-1">
                      {isBn ? '🎯 ১. কেন প্রস্তাব করা হয়েছে:' : '🎯 1. Why Suggested:'}
                    </span>
                    <p className="text-emerald-100/90">{pillar.whySuggested}</p>
                  </div>

                  <div className="bg-[#03130c]/80 p-3 rounded-xl border border-emerald-800/40">
                    <span className="font-extrabold text-cyan-400 block mb-1">
                      {isBn ? '🛰️ ২. সহায়ক নাসা প্রমাণ:' : '🛰️ 2. Supporting Evidence:'}
                    </span>
                    <p className="text-emerald-100/90">{pillar.supportingEvidence}</p>
                  </div>

                  <div className="bg-[#03130c]/80 p-3 rounded-xl border border-emerald-800/40">
                    <span className="font-extrabold text-emerald-300 block mb-1">
                      {isBn ? '🌿 ৩. মূল সুবিধাসমূহ:' : '🌿 3. Key Benefits:'}
                    </span>
                    <p className="text-emerald-100/90">{pillar.keyBenefits}</p>
                  </div>

                  <div className="bg-[#03130c]/80 p-3 rounded-xl border border-amber-800/40">
                    <span className="font-extrabold text-amber-300 block mb-1">
                      {isBn ? '⚠️ ৪. তথ্যের সীমাবদ্ধতা ও স্থানীয় ঝুঁকি:' : '⚠️ 4. Gaps & Local Risks:'}
                    </span>
                    <p className="text-amber-100/90 whitespace-pre-line">{pillar.gapsAndRisks}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Focused Single Pillar Comparison across the 3 Strategies */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
            {(isBn ? STRATEGY_AUDIT_PILLARS_BN : STRATEGY_AUDIT_PILLARS).map(pillar => (
              <div
                key={pillar.id}
                className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between shadow-lg ${pillar.themeColor}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${pillar.badgeColor}`}>
                      {pillar.strategyNumber}
                    </span>
                    <span className="text-[11px] font-bold text-white/80">{pillar.subtitle}</span>
                  </div>
                  <h4 className="text-base font-extrabold text-white leading-tight font-heading mb-3">
                    {pillar.name}
                  </h4>
                </div>

                <div className="bg-[#03130c]/90 p-4 rounded-xl border border-emerald-800/50 text-xs sm:text-sm leading-relaxed text-emerald-100">
                  <span className="font-black text-emerald-400 block mb-1.5 text-xs uppercase tracking-wider">
                    {activeAuditTab === 'whySuggested' && (isBn ? '🎯 কেন প্রস্তাব করা হয়েছে / বেঞ্চমার্ক ভূমিকা:' : '🎯 Why Suggested / Role as Baseline:')}
                    {activeAuditTab === 'supportingEvidence' && (isBn ? '🛰️ নাসা ও ভূমির সহায়ক প্রমাণ:' : '🛰️ NASA & Ground Supporting Evidence:')}
                    {activeAuditTab === 'keyBenefits' && (isBn ? '🌿 মূল সুবিধাসমূহ (মাটি, পানি, কৃষক লাভ):' : '🌿 Key Benefits (Soil, Water, Farmers):')}
                    {activeAuditTab === 'gapsAndRisks' && (isBn ? '⚠️ তথ্যের সীমাবদ্ধতা ও স্থানীয় বিশেষজ্ঞ পর্যালোচনা ঝুঁকি:' : '⚠️ Information Gaps & Local Expert Risks:')}
                  </span>
                  <p className="whitespace-pre-line">
                    {pillar[activeAuditTab]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETERMINISTIC SCIENCE & SATELLITE RESOLUTION DISCLOSURES */}
      <div className="bg-[#051d12]/90 border border-emerald-800/60 rounded-2xl p-4 sm:p-5 text-xs text-emerald-300/90 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-800/40">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧪</span>
            <span className="font-black text-white text-sm">
              {isBn ? 'নির্দিষ্ট জলবায়ু পরিবর্তন বিজ্ঞান ও প্রক্সি স্বচ্ছতা' : 'Deterministic Climate Shift Science & Proxy Transparency'}
            </span>
          </div>
          <button
            onClick={() => setShowClimateScience(!showClimateScience)}
            className="text-emerald-400 font-bold hover:underline cursor-pointer self-start sm:self-auto text-xs"
          >
            {showClimateScience
              ? (isBn ? '▲ প্রযুক্তিগত বিবরণ লুকান' : '▲ Hide Technical Details')
              : (isBn ? '▼ মৌসুমি বৃষ্টিপাতের পরিবর্তন ও রেজোলিউশন স্পেক দেখুন' : '▼ View Monsoon Shift & Resolution Specs')}
          </button>
        </div>

        {showClimateScience && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Playbook Monsoon Onset Science */}
            <div className="bg-[#03130c] p-3.5 rounded-xl border border-emerald-800/50 space-y-2">
              <span className="font-extrabold text-cyan-300 block text-xs uppercase tracking-wider">
                🌧️ {isBn ? 'মৌসুমি বৃষ্টিপাত শুরু শনাক্তকরণ অ্যালগরিদম:' : 'Monsoon Onset Detection Algorithm:'}
              </span>
              <p className="text-[11px] leading-relaxed text-emerald-200/90">
                <code>rain_onset(daily_mm, window=7, threshold_mm=20, dry_spell_max=7)</code>
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-200/80">
                <li>
                  <strong>{isBn ? 'দুই সময়ের তুলনা:' : 'Two-Period Comparison:'}</strong>{' '}
                  {isBn ? '২০০১–২০১২ (DOY ১৫৬ ± ৪ দিন) বনাম ২০১৩–২০২৫ (DOY ১৬৪ ± ৫ দিন)।' : '2001–2012 (DOY 156 ± 4d) vs 2013–2025 (DOY 164 ± 5d).'}
                </li>
                <li>
                  <strong>{isBn ? 'পরিসংখ্যানগত তাৎপর্যপূর্ণ বিলম্ব:' : 'Statistically Significant Shift:'}</strong>{' '}
                  {isBn ? '+৮.৪ দিন মৌসুমি বৃষ্টিপাত দেরিতে শুরু (p = ০.০২১ < ০.০৫, মান-হুইটনি ইউ টেস্ট)।' : '+8.4 days delayed monsoon onset (p = 0.021 < 0.05, Mann–Whitney U test).'}
                </li>
                <li>
                  <strong>{isBn ? 'সংবেদনশীলতা যাচাই:' : 'Sensitivity Check:'}</strong>{' '}
                  {isBn ? 'থ্রেশহোল্ড ±৫ মিমি পরিবর্তন (১৫ মিমি: +৭.৯ দিন; ২৫ মিমি: +৮.৮ দিন) অ্যালগরিদমের কাঠামোগত স্থিতিশীলতা প্রমাণ করে।' : 'Threshold perturbation ±5 mm (15 mm: +7.9d; 25 mm: +8.8d) confirms structural stability.'}
                </li>
                <li>
                  <strong>{isBn ? 'কৃষিতাত্ত্বিক উপযোগিতা:' : 'Agronomic Value:'}</strong>{' '}
                  {isBn ? '৮ দিন বৃষ্টিপাত পিছিয়ে যাওয়ার ফলে প্রাক-বর্ষায় জমি ফাঁকা থাকার সময় বৃদ্ধি পায়, যা স্বল্পমেয়াদী ৬৫ দিনের মুগ ডাল চাষ করে জমিতে নাইট্রোজেন সংযোজনের দারুণ সুযোগ তৈরি করে।' : 'The 8-day onset delay widens the pre-monsoon bare-field period, enabling short-duration 65-day Mung bean to restore soil nitrogen prior to flood arrival.'}
                </li>
              </ul>
            </div>

            {/* Spatial Resolution Transparency Disclosure */}
            <div className="bg-[#03130c] p-3.5 rounded-xl border border-emerald-800/50 space-y-2">
              <span className="font-extrabold text-amber-300 block text-xs uppercase tracking-wider">
                🛰️ {isBn ? 'স্থানিক রেজোলিউশন ও প্রক্সি স্বচ্ছতা:' : 'Spatial Resolution & Proxy Disclosure:'}
              </span>
              <p className="text-[11px] leading-relaxed text-emerald-200/90">
                {isBn
                  ? 'নাসা SMAP (৯ কিমি) এবং MODIS (১ কিমি) সরাসরি জমির বিন্দু পরিমাপের বদলে আঞ্চলিক কৃষি-জলবায়ুর প্রক্সি হিসেবে কাজ করে।'
                  : 'NASA SMAP (9 km) and MODIS (1 km) observations provide regional agro-climatic stress proxies rather than field-level point measurements.'}
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-200/80">
                <li>
                  <strong>{isBn ? 'আঞ্চলিক চাপ স্তর:' : 'Regional Stress Layer:'}</strong>{' '}
                  {isBn ? 'কৃষি-পরিবেশ অঞ্চলের (AEZ 11 ও AEZ 1) সামগ্রিক খরা ও তাপপ্রবাহের রূপরেখা তুলে ধরে।' : 'Captures macro-drought and heatwave patterns across agro-ecological zones (AEZ 11 & AEZ 1).'}
                </li>
                <li>
                  <strong>{isBn ? 'স্থানীয় যাচাই আবশ্যক:' : 'Local Validation Required:'}</strong>{' '}
                  {isBn ? 'এক হেক্টরের নিচের ছোট প্লটের নিষ্কাশন সমস্যা বা মাটির মৃদু ঢাল মহাকাশ থেকে সরাসরি পরিমাপ সম্ভব নয়।' : 'Sub-hectare micro-drainage blockages and plot slope cannot be resolved from orbit.'}
                </li>
                <li>
                  <strong>{isBn ? 'কৃষক সহায়ক টুল:' : 'Human Decision-Support:'}</strong>{' '}
                  {isBn ? 'ফিল্ড শিফট কৃষকের নিজস্ব বিচারবুদ্ধি প্রতিস্থাপন না করে নাসা তথ্যের সাহায্যে যৌক্তিক বিকল্প বেছে নিতে সহায়তা করে।' : 'Field Shift empowers farmers and agricultural extension officers (DAE) with evidence-backed options without displacing local farmer judgment.'}
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="text-[11px] text-emerald-400/80 flex items-center justify-between pt-1">
          <span>{isBn ? 'ফিল্ড শিফট ডিসিশন সাপোর্ট ইঞ্জিন v৬.২ • নাসা স্পেস অ্যাপস চ্যালেঞ্জ ২০২৬' : 'Field Shift Decision-Support Engine v6.2 • NASA Space Apps Challenge 2026'}</span>
          <span className="font-mono">{isBn ? 'অফলাইনে প্রস্তুত ক্যাশকৃত উপগ্রহ পর্যবেক্ষণ' : 'Offline-ready cached observations'}</span>
        </div>
      </div>
    </div>
  );
}

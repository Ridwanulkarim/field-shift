// Ready-made demo scenarios for presenting the app (one per story the engine can tell). Each "request" is a valid
// POST /api/evaluate body for one of the 12 pilot districts.
//
// WHAT THESE ARE: illustrative farmer situations chosen so that different districts, soils, water access and priorities
// give visibly different rankings. The soil and irrigation values are DEMO INPUTS, not measurements of any real farm and
// not SRDI/BARC survey results; the app must present them as "example field". The climate they are scored against is
// the real NASA POWER series for the district's grid cell.
// Check them with: npm run demo:scenarios

export const DEMO_SCENARIOS = [
  {
    id: 'rajshahi-dry-barind',
    titleEn: 'Dry north-west: save irrigation water',
    titleBn: 'শুষ্ক উত্তর-পশ্চিম: সেচের পানি সাশ্রয়',
    story: 'A Rajshahi farmer on well-drained soil with limited pump access wants to cut dry-season irrigation without losing the household rice.',
    request: {
      district: 'rajshahi',
      existingRotation: ['boro', 'aman'],
      soil: { salinity: 'none', drainage: 'good' },
      irrigation: 'limited',
      priorities: { waterSaving: 3, heatResilience: 2, soilHealth: 2, diversification: 1, lowInput: 1 },
    },
  },
  {
    id: 'khulna-saline-coast',
    titleEn: 'Saline south-west: crops that tolerate salt',
    titleBn: 'লবণাক্ত দক্ষিণ-পশ্চিম: লবণসহনশীল ফসল',
    story: 'A Khulna farmer with moderately saline, slowly draining soil and no reliable irrigation keeps only monsoon rice today.',
    request: {
      district: 'khulna',
      existingRotation: ['aman'],
      soil: { salinity: 'moderate', drainage: 'poor' },
      irrigation: 'none',
      priorities: { waterSaving: 2, heatResilience: 1, soilHealth: 2, diversification: 1, lowInput: 2 },
    },
  },
  {
    id: 'rangpur-intensive-potato',
    titleEn: 'North: intensive rotation with reliable water',
    titleBn: 'উত্তর: নির্ভরযোগ্য সেচসহ ঘন ফসলচক্র',
    story: 'A Rangpur farmer with reliable irrigation grows potato then rice and wants to spread risk across more crops.',
    request: {
      district: 'rangpur',
      existingRotation: ['potato', 'aman'],
      soil: { salinity: 'none', drainage: 'moderate' },
      irrigation: 'reliable',
      priorities: { waterSaving: 1, heatResilience: 1, soilHealth: 1, diversification: 3, lowInput: 1 },
    },
  },
  {
    id: 'sylhet-wet-lowland',
    titleEn: 'Wet north-east: poor drainage and heavy rain',
    titleBn: 'আর্দ্র উত্তর-পূর্ব: পানি নিষ্কাশন সমস্যা',
    story: 'A Sylhet farmer on poorly drained land with no irrigation depends on the monsoon and worries about waterlogging.',
    request: {
      district: 'sylhet',
      existingRotation: ['aman'],
      soil: { salinity: 'none', drainage: 'poor' },
      irrigation: 'none',
      priorities: { waterSaving: 0, heatResilience: 1, soilHealth: 2, diversification: 1, lowInput: 2 },
    },
  },
  {
    id: 'jashore-low-cost-pulses',
    titleEn: 'South-west: cut input costs, add a legume',
    titleBn: 'দক্ষিণ-পশ্চিম: কম খরচ ও ডালজাতীয় ফসল',
    story: 'A Jashore farmer running Boro then Aman wants lower input costs and better soil from a legume.',
    request: {
      district: 'jashore',
      existingRotation: ['boro', 'aman'],
      soil: { salinity: 'slight', drainage: 'moderate' },
      irrigation: 'reliable',
      priorities: { waterSaving: 1, heatResilience: 1, soilHealth: 3, diversification: 1, lowInput: 3 },
    },
  },
  {
    id: 'mymensingh-heat-risk',
    titleEn: 'Central: avoid spring heat on winter crops',
    titleBn: 'মধ্যাঞ্চল: বসন্তের তাপ এড়ানো',
    story: 'A Mymensingh farmer growing wheat and Aman is worried about late-season heat during grain filling.',
    request: {
      district: 'mymensingh',
      existingRotation: ['wheat', 'aman'],
      soil: { salinity: 'none', drainage: 'good' },
      irrigation: 'limited',
      priorities: { waterSaving: 1, heatResilience: 3, soilHealth: 1, diversification: 1, lowInput: 1 },
    },
  },
];

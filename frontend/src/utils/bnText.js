// Bangla for every piece of English text the backend sends back (limitations, disclaimers, trade-offs, summaries,
// stability notes, validation errors). The pages hold their own Bangla for fixed UI text; this file is for text that
// comes from the API, where the API only has a Bangla twin for some fields.
//
//   tr(text, language)   -> Bangla when language is "bn" and a translation exists, otherwise the text unchanged.
//   trList(list, language)
//   bnDigits(value)      -> "2025" -> "২০২৫"
//
// Exact sentences live in EXACT; sentences with numbers or names inside live in PATTERNS. frontend/scripts/
// check-bn-coverage.mjs fails when a backend sentence has no entry here, so a new backend sentence cannot slip
// through untranslated.

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const bnDigits = (value) =>
  String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

const COMPONENTS = {
  "Rainfall covers water need": "বৃষ্টি পানির চাহিদা মেটায়",
  "Low heat-stress exposure": "তাপজনিত চাপ কম",
  "Fits your soil conditions": "আপনার মাটির অবস্থার সঙ্গে মানানসই",
  "Low irrigation requirement": "সেচের প্রয়োজন কম",
  "Soil-health practices (legume, variety)":
    "মাটির স্বাস্থ্য-সহায়ক চর্চা (ডালজাতীয় ফসল, বৈচিত্র্য)",
  "Crop variety (risk spreading proxy)":
    "ফসলের বৈচিত্র্য (ঝুঁকি ভাগ করার নির্দেশক)",
  "Low input intensity": "কম উপকরণ ব্যবহার",
  "Plot kept in crop (cropping intensity)":
    "জমিতে ফসল থাকার সময় (চাষের ঘনত্ব)",
  "Staple cereal for the household (up to two crops)":
    "পরিবারের প্রধান খাদ্যশস্য (সর্বোচ্চ দুটি ফসল)",
};

const PRIORITY_LABELS = {
  "Save irrigation water": "সেচের পানি সাশ্রয়",
  "Avoid heat stress": "তাপজনিত ক্ষতি এড়ানো",
  "Look after the soil": "মাটির যত্ন",
  "Spread risk across crops": "ঝুঁকি ভাগ করা (বৈচিত্র্য)",
  "Keep input costs low": "কম খরচে চাষ",
};

const EXACT = {
  // ---- evaluate: LIMITATIONS
  "Climate values are NASA POWER grid-cell values (about 0.5 degrees), not measurements on your field.":
    "জলবায়ুর মানগুলো NASA POWER-এর গ্রিড সেলের (প্রায় ০.৫ ডিগ্রি) মান, আপনার জমিতে মাপা তথ্য নয়।",
  "Crop traits in this version are unverified general-knowledge assumptions and must be reviewed by an agronomist.":
    "এই সংস্করণে ফসলের বৈশিষ্ট্যগুলো সাধারণ জ্ঞানের ভিত্তিতে ধরে নেওয়া, যাচাই করা নয়; কৃষিবিজ্ঞানীর পর্যালোচনা প্রয়োজন।",
  "The score ranks options under simple rules. It does not predict yield, profit, or soil improvement.":
    "স্কোর সহজ নিয়মে বিকল্পগুলোকে ক্রমানুসারে সাজায়। এটি ফলন, লাভ বা মাটির উন্নতির পূর্বাভাস দেয় না।",
  "Only the information you enter and the loaded climate data are considered: no prices, pests, diseases, seed supply, labour or flood timing. Erosion, organic matter, forage value and market suitability are not modelled (see notModeled).":
    "শুধু আপনার দেওয়া তথ্য ও লোড করা জলবায়ু তথ্য বিবেচনা করা হয়েছে: দাম, পোকামাকড়, রোগ, বীজের সরবরাহ, শ্রম বা বন্যার সময় ধরা হয়নি। মাটি ক্ষয়, জৈব পদার্থ, গবাদিপশুর খাদ্যমূল্য ও বাজারের উপযোগিতা মডেলে অন্তর্ভুক্ত নয় (“মডেলে অন্তর্ভুক্ত নয়” অংশ দেখুন)।",
  'The "documented pattern" filter uses a secondary reading of BRRI/BARI papers that an agronomist has not yet confirmed. It does not mean a pattern is recommended for your farm.':
    "“নথিভুক্ত পদ্ধতি” ফিল্টারটি BRRI/BARI-র প্রবন্ধের দ্বিতীয় স্তরের পাঠের ওপর ভিত্তি করে, যা কৃষিবিজ্ঞানী এখনো নিশ্চিত করেননি। এর মানে এই নয় যে পদ্ধতিটি আপনার জমির জন্য সুপারিশ করা হচ্ছে।",
  "Trend statements are indicative: the series are short and a rough statistical hint is not proof of climate change.":
    "প্রবণতার বিবৃতিগুলো ইঙ্গিতমাত্র: তথ্যের সময়কাল ছোট, আর একটি মোটামুটি পরিসংখ্যানগত ইঙ্গিত জলবায়ু পরিবর্তনের প্রমাণ নয়।",
  "Missing days are never treated as zero rain. Rainfall windows use consecutive calendar days; years with too many unobserved days are left out and, for onset and dry spells, the response says which years were unknown.":
    "অনুপস্থিত দিনকে কখনো শূন্য বৃষ্টি ধরা হয় না। বৃষ্টির হিসাবে পরপর ক্যালেন্ডার দিন ব্যবহার করা হয়; যেসব বছরে পর্যবেক্ষণহীন দিন বেশি, সেগুলো বাদ দেওয়া হয়, এবং বৃষ্টি শুরু ও শুষ্ক সময়ের ক্ষেত্রে কোন বছরগুলো অজানা ছিল তা ফলাফলে জানানো হয়।",

  // ---- evaluate: DISCLAIMER
  "Aboho is a decision-support tool. It explores options using climate data and simple, documented rules. It does not predict yield or profit and does not replace the judgment of the farmer or advice from local agricultural extension officers.":
    "আবহ একটি সিদ্ধান্ত-সহায়ক সরঞ্জাম। এটি জলবায়ু তথ্য ও সহজ, নথিভুক্ত নিয়ম ব্যবহার করে বিকল্প অনুসন্ধান করে। এটি ফলন বা লাভের পূর্বাভাস দেয় না এবং কৃষকের বিচার বা স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শের বিকল্প নয়।",

  // ---- evaluate: NOT_MODELED (the API also sends a Bangla twin; listed so tr() works on either)
  "Soil erosion and runoff": "মাটি ক্ষয় ও পানির প্রবাহ",
  "Soil organic matter (only a legume and plant-family variety are used as a rough proxy)":
    "মাটির জৈব পদার্থ (শুধু ডালজাতীয় ফসল ও উদ্ভিদ পরিবারের বৈচিত্র্য মোটামুটি নির্দেশক হিসেবে ধরা হয়েছে)",
  "Fodder and forage value of crop residues":
    "গবাদিপশুর খাদ্য ও ফসলের অবশিষ্টাংশের মূল্য",
  "Prices, market access and income (cropping intensity is the only land-use proxy)":
    "দাম, বাজারের সুযোগ ও আয় (শুধু জমি ব্যবহারের হার ধরা হয়েছে)",
  "Pest and disease cycles beyond plant-family variety":
    "পোকামাকড় ও রোগের চক্র (উদ্ভিদ পরিবারের বৈচিত্র্যের বাইরে)",
  "Seed supply, labour, and flood timing": "বীজের সরবরাহ, শ্রম ও বন্যার সময়",

  // ---- ranking stability
  "The top-ranked rotation stays first in most of the weight changes tried, so the ranking does not hinge on one weight.":
    "যে কয়েকটি ওজন পরিবর্তন পরীক্ষা করা হয়েছে, তার বেশিরভাগেই সর্বোচ্চ স্কোরের পর্যায় প্রথম থাকে, তাই র‍্যাঙ্কিং কোনো একটি ওজনের ওপর নির্ভর করে না।",
  "The top-ranked rotation stays first in about half or more of the weight changes tried; treat the top few options as close.":
    "পরীক্ষা করা ওজন পরিবর্তনের প্রায় অর্ধেক বা তার বেশিতে সর্বোচ্চ স্কোরের পর্যায় প্রথম থাকে; শীর্ষ কয়েকটি বিকল্পকে কাছাকাছি ধরে নিন।",
  "The top-ranked rotation often changes when a weight changes. Treat the top options as roughly equal and decide on practical grounds.":
    "কোনো ওজন বদলালে সর্বোচ্চ স্কোরের পর্যায় প্রায়ই বদলে যায়। শীর্ষ বিকল্পগুলোকে প্রায় সমান ধরে ব্যবহারিক বিবেচনায় সিদ্ধান্ত নিন।",

  // ---- rotation summaries
  "The current rotation could not be scored.":
    "বর্তমান পর্যায়ের স্কোর নির্ণয় করা যায়নি।",

  // ---- planting advisory: PLANTING_LIMITATIONS
  "Onset is a heuristic definition: the first 7-day rainfall total of at least 50 mm on or after the crop's season-start date (1 May for Aus, 1 June for Aman), not an official monsoon index. The start dates are unverified agronomic assumptions.":
    "বৃষ্টি শুরু একটি অনুমানভিত্তিক সংজ্ঞা: ফসলের মৌসুম শুরুর তারিখে (আউশের জন্য ১ মে, আমনের জন্য ১ জুন) বা তার পরে প্রথম যে ৭ দিনের মোট বৃষ্টি অন্তত ৫০ মিমি; এটি সরকারি মৌসুমি বায়ুর সূচক নয়। শুরুর তারিখগুলো যাচাই-না-করা কৃষিগত অনুমান।",
  "Rainfall is a NASA POWER grid-cell value (about 0.5 degrees) from a single modelled source, not a measurement on the field, and it has not been checked against an independent dataset.":
    "বৃষ্টির মান NASA POWER-এর একটি গ্রিড সেলের (প্রায় ০.৫ ডিগ্রি) মান, একটি মডেলভিত্তিক উৎস থেকে নেওয়া; এটি জমিতে মাপা তথ্য নয় এবং কোনো স্বাধীন তথ্যভান্ডারের সঙ্গে যাচাই করা হয়নি।",
  "A shift between two periods of a short series is an indication, not proof of climate change; natural variability can produce it.":
    "ছোট একটি তথ্যসারির দুই সময়কালের মধ্যে পরিবর্তন একটি ইঙ্গিত, জলবায়ু পরিবর্তনের প্রমাণ নয়; স্বাভাবিক ওঠানামাও এমন পরিবর্তন ঘটাতে পারে।",
  "The recommendation is a number of days to move planting. It does not state exact dates, and rainfall alone does not decide the right planting date.":
    "সুপারিশটি রোপণ কত দিন সরাতে হবে তার সংখ্যা মাত্র। এতে নির্দিষ্ট তারিখ বলা হয় না, আর শুধু বৃষ্টি দিয়ে রোপণের সঠিক তারিখ ঠিক হয় না।",
  "Growing degree day parameters (10 C base, 35 C cap) are unverified general values, not variety-specific.":
    "বৃদ্ধি-তাপমাত্রা-দিন (GDD) হিসাবের মান (১০° সে. ভিত্তি, ৩৫° সে. সীমা) যাচাই-না-করা সাধারণ মান, কোনো জাতভিত্তিক নয়।",
  "The revised window is your own usual window moved by the supported shift in the start of usable rain. It is not an agronomically derived transplanting window.":
    "সংশোধিত সময়কালটি আপনার নিজের চিরাচরিত সময়কালকেই কার্যকর বৃষ্টি শুরুর সমর্থিত পরিবর্তন অনুযায়ী সরানো হয়েছে। এটি কৃষিবিজ্ঞানের হিসাবে নির্ধারিত রোপণের সময় নয়।",
  "Experimental: for Aus the May rainfall in NASA POWER was not confirmed by an independent source (ERA5), so any change in when rain starts may partly reflect the data and not the weather. Use Aman for decisions.":
    "পরীক্ষামূলক: আউশের ক্ষেত্রে NASA POWER-এর মে মাসের বৃষ্টি স্বাধীন উৎস (ERA5) দিয়ে নিশ্চিত হয়নি, তাই বৃষ্টি শুরুর পরিবর্তন আংশিকভাবে আবহাওয়ার বদলে তথ্যের প্রভাব হতে পারে। সিদ্ধান্তের জন্য আমন দেখুন।",
  "For crops whose onset is searched from May, NASA POWER's May rainfall has not been corroborated by an independent source: in a cross-check for Rajshahi it rose far more than ERA5 reanalysis over the same years, so an earlier onset may partly reflect the data source rather than the weather.":
    "যেসব ফসলের বৃষ্টি শুরুর সময় মে মাস থেকে খোঁজা হয়, তাদের ক্ষেত্রে NASA POWER-এর মে মাসের বৃষ্টি কোনো স্বাধীন উৎসে যাচাই হয়নি: রাজশাহীর একটি পরীক্ষায় একই বছরগুলোতে ERA5-এর তুলনায় তা অনেক বেশি বেড়েছে, তাই আগে বৃষ্টি শুরুর ফলাফল আংশিকভাবে আবহাওয়ার বদলে তথ্যের উৎসের প্রভাব হতে পারে।",

  // ---- field-based evaluation limitations
  "The field polygon intersects more than one provider grid cell. Only the cell containing the representative point is reported.":
    "জমির বহুভুজ একাধিক গ্রিড সেলের ওপর পড়েছে। শুধু প্রতিনিধিত্বকারী বিন্দুটি যে সেলে আছে, সেই সেলের তথ্য দেখানো হয়েছে।",
  "The cell geometry follows the assumed POWER grid (0.5 x 0.625 degrees) and has not yet been confirmed against the live service (npm run check:power-grid).":
    "সেলের জ্যামিতি ধরে নেওয়া POWER গ্রিড (০.৫ × ০.৬২৫ ডিগ্রি) অনুসারে; এটি এখনো সরাসরি সেবার সঙ্গে নিশ্চিত করা হয়নি (npm run check:power-grid)।",

  // ---- common errors that carry an English message
  "Too many requests. Try again shortly.":
    "অনেক বেশি অনুরোধ হয়েছে। একটু পরে আবার চেষ্টা করুন।",
  "The request origin is not allowed.": "এই উৎস থেকে অনুরোধ অনুমোদিত নয়।",
  "The request body is not valid JSON.": "পাঠানো তথ্যের ধরন সঠিক নয়।",
  "The request body is too large.": "পাঠানো তথ্য অনেক বড়।",
  "Something went wrong on the server.":
    "সার্ভারে একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
  "No database connection is configured.": "ডেটাবেস সংযোগ ঠিক করা নেই।",
  "The database could not be reached.": "ডেটাবেসে যোগাযোগ করা যায়নি।",
  "The selected field must belong to the selected district.":
    "নির্বাচিত জমিটি নির্বাচিত জেলার হতে হবে।",
  "This field has no boundary, so its climate cell cannot be determined.":
    "এই জমির সীমানা নেই, তাই এর জলবায়ু সেল নির্ধারণ করা যায়নি।",

  // ---- validation messages
  "Unknown field.": "অজানা ঘর।",
  "Unknown query parameter.": "অজানা প্রশ্ন-প্যারামিটার।",
  "Send a JSON object.": "একটি সঠিক তথ্য-কাঠামো পাঠান।",
  "Provide at least one field property to update.":
    "হালনাগাদ করতে অন্তত একটি তথ্য দিন।",
  "Must be a valid UUID.": "একটি সঠিক শনাক্তকারী কোড হতে হবে।",
  "Must be a valid field UUID.": "জমির একটি সঠিক শনাক্তকারী কোড হতে হবে।",
  "Must be a [longitude, latitude] coordinate with finite numbers.":
    "[দ্রাঘিমাংশ, অক্ষাংশ] আকারে সঠিক সংখ্যার স্থানাঙ্ক হতে হবে।",
  "Longitude must be between -180 and 180 and latitude between -90 and 90.":
    "দ্রাঘিমাংশ −১৮০ থেকে ১৮০ এবং অক্ষাংশ −৯০ থেকে ৯০-এর মধ্যে হতে হবে।",
  "Each linear ring must contain at least four positions.":
    "সীমানার প্রতিটি বদ্ধ রেখায় অন্তত চারটি বিন্দু থাকতে হবে।",
  "Each linear ring must be closed.":
    "সীমানার প্রতিটি রেখা বন্ধ (শুরু ও শেষ বিন্দু এক) হতে হবে।",
  "Must contain at least one polygon.": "অন্তত একটি সীমানা-এলাকা থাকতে হবে।",
  "Must be a GeoJSON Polygon or MultiPolygon.":
    "সীমানা একটি সঠিক GeoJSON বহুভুজ হতে হবে।",
  "Area is calculated by the backend and must not be provided.":
    "আয়তন সিস্টেম নিজেই হিসাব করে; এটি দেওয়ার প্রয়োজন নেই।",
  "Required: a positive integer.": "আবশ্যক: একটি ধনাত্মক পূর্ণসংখ্যা।",
  "Must be an object.": "সঠিক কাঠামোতে দিতে হবে।",
  'Required: a district slug such as "rajshahi".':
    "আবশ্যক: একটি জেলা নির্বাচন করুন।",
  'Every crop must be a slug such as "aman".':
    "প্রতিটি ফসল তালিকা থেকে নির্বাচন করতে হবে।",
  "The same crop is listed twice.": "একই ফসল দুইবার দেওয়া হয়েছে।",
  "Unknown priority.": "অজানা অগ্রাধিকার।",
  "Must be true or false.": "হ্যাঁ বা না হতে হবে।",
  'Must be "en" or "bn".': "ভাষা ইংরেজি বা বাংলা হতে হবে।",
  'Must be "true" or "false".': "হ্যাঁ বা না হতে হবে।",
  "Give both usualFrom and usualTo, or neither.":
    "শুরু ও শেষ দুটি তারিখই দিন, অথবা কোনোটিই নয়।",
  "Must not be earlier in the year than usualFrom.":
    "শেষের তারিখ শুরুর তারিখের আগে হতে পারবে না।",
  "Must be a real date as MM-DD, for example 07-15 (29 February is not accepted).":
    "একটি সঠিক তারিখ (মাস-দিন) দিন, যেমন ১৫ জুলাই (২৯ ফেব্রুয়ারি গ্রহণযোগ্য নয়)।",
  "Must be a real date as MM-DD, for example 08-15 (29 February is not accepted).":
    "একটি সঠিক তারিখ (মাস-দিন) দিন, যেমন ১৫ আগস্ট (২৯ ফেব্রুয়ারি গ্রহণযোগ্য নয়)।",
  'Required. A crop slug such as "aman" (lowercase letters and hyphens).':
    "আবশ্যক: একটি ফসল নির্বাচন করুন।",
};

const num = (s) => bnDigits(s);
const compLabel = (s) => COMPONENTS[s] ?? s;

// [regex, (…captures) => Bangla]. The first match wins.
const PATTERNS = [
  // "<component label>: +12 points (you rated "<priority>" 2/3)"
  [
    /^(.+?): ([+\-−]?\d+) points(?: \(you rated "(.+)" (\d)\/3\))?$/,
    (_, label, n, pr, level) =>
      `${compLabel(label)}: ${num(n.replace("-", "−"))} পয়েন্ট${
        pr
          ? ` (আপনি “${PRIORITY_LABELS[pr] ?? pr}”-কে ${num(level)}/${num(3)} দিয়েছেন)`
          : ""
      }`,
  ],
  [
    /^Uses the plot for about (\d+) months a year instead of (\d+) \(lower cropping intensity\)$/,
    (_, a, b) =>
      `জমি বছরে প্রায় ${num(a)} মাস ব্যবহার হয়, আপনার বর্তমান পর্যায়ে ${num(b)} মাস (চাষের ঘনত্ব কম)`,
  ],
  // field-based evaluation: cell limitation
  [
    /^Values describe the whole NASA POWER grid cell \(([\d.]+) x ([\d.]+) degrees, about ([\d,]+) km2\) that contains the field's representative point\..*$/,
    (_, a, b, area) =>
      `মানগুলো NASA POWER-এর পুরো গ্রিড সেলের (${num(a)} × ${num(b)} ডিগ্রি, প্রায় ${num(area)} বর্গ কিমি), যে সেলে জমির প্রতিনিধিত্বকারী বিন্দুটি আছে। এগুলো জমিতে মাপা তথ্য নয়, আর জমির সীমানা কোনো বাড়তি স্থানিক তথ্য দেয় না।`,
  ],
  // validation
  [
    /^Must be a finite number from (.+) to (.+)\.$/,
    (_, a, b) => `${num(a)} থেকে ${num(b)}-এর মধ্যে একটি সংখ্যা হতে হবে।`,
  ],
  [
    /^Must be a whole number from (\d+) to (\d+)\.$/,
    (_, a, b) => `${num(a)} থেকে ${num(b)}-এর মধ্যে একটি পূর্ণসংখ্যা হতে হবে।`,
  ],
  [
    /^Required: non-empty text of at most (\d+) characters\.$/,
    (_, n) => `আবশ্যক: অনধিক ${num(n)} অক্ষরের লেখা, ফাঁকা রাখা যাবে না।`,
  ],
  [
    /^Must be text of at most (\d+) characters\.$/,
    (_, n) => `অনধিক ${num(n)} অক্ষরের লেখা হতে হবে।`,
  ],
  [
    /^Must contain no more than (\d+) coordinate positions\.$/,
    (_, n) => `সীমানায় সর্বোচ্চ ${num(n)}টি বিন্দু থাকতে পারবে।`,
  ],
  [
    /^Boundary must lie within Bangladesh\b.*$/,
    () =>
      "জমির সীমানা অবশ্যই বাংলাদেশের ভেতরে হতে হবে। স্থানাঙ্ক [দ্রাঘিমাংশ, অক্ষাংশ] ক্রমে আছে কি না দেখুন।",
  ],
  [
    /^Required: a list of 1 to (\d+) crop slugs\.$/,
    (_, n) => `আবশ্যক: ১ থেকে ${num(n)}টি ফসলের তালিকা।`,
  ],
  [
    /^Must be one of: .+\.$/,
    () => "তালিকার মধ্য থেকে একটি বিকল্প নির্বাচন করতে হবে।",
  ],
  [/^Unknown constraint\..*$/, () => "অজানা শর্ত।"],
  [
    /^The window may be at most (\d+) days long\.$/,
    (_, n) => `সময়কাল সর্বোচ্চ ${num(n)} দিনের হতে পারবে।`,
  ],
  [
    /^Must be a four-digit year between (\d+) and (\d+)\.$/,
    (_, a, b) =>
      `${num(a)} থেকে ${num(b)}-এর মধ্যে একটি চার অঙ্কের সাল হতে হবে।`,
  ],
  [/^Unknown crop "(.+)"\.$/, () => "ফসলটি চেনা যায়নি।"],
  [/^Unknown crop\(s\): .+\.$/, () => "এক বা একাধিক ফসল চেনা যায়নি।"],
  [
    /^These crops cannot share one year on the same plot: .+\.$/,
    () => "এই ফসলগুলো একই জমিতে একই বছরে চাষ করা যায় না।",
  ],
  [/^No district with (?:slug|id) ".+"\.$/, () => "জেলাটি পাওয়া যায়নি।"],
  [/^No field with id ".+"\.$/, () => "জমিটি পাওয়া যায়নি।"],
  [
    /^No real NASA POWER data is available for district ".+"\.$/,
    () => "এই জেলার জন্য NASA POWER-এর প্রকৃত তথ্য এখনো নেই।",
  ],
  [/^No route for .+$/, () => "এই ঠিকানায় কিছু পাওয়া যায়নি।"],
  // rotation summaries
  [
    /^Your current rotation scores (\S+) out of 100 on these heuristic rules; (\d+) of (\d+) alternative rotations that pass the filters scored higher\.(.*)$/s,
    (_, s, beating, total, rest) =>
      `আপনার বর্তমান পর্যায় এই অনুমানভিত্তিক নিয়মে ১০০-র মধ্যে ${num(s)} পেয়েছে; ফিল্টার পার হওয়া ${num(total)}টি বিকল্পের মধ্যে ${num(beating)}টির স্কোর বেশি।${
        /A low rank here mostly reflects/.test(rest)
          ? " আপনার পর্যায়টি নিজেই একটি নথিভুক্ত পদ্ধতি। এখানে নিচু র‍্যাঙ্কের কারণ মূলত এর বেশি পানি, তাপ ও উপকরণ ব্যবহার: ফলন, খাদ্য উৎপাদন ও আয় মডেলে ধরা হয়নি, তাই এর মানে এই নয় যে আপনার পদ্ধতি ভুল।"
          : ""
      }`,
  ],
  [
    /^Ranked #(\d+) of (\d+) alternatives that pass the filters, scoring (\S+?)(?: \(([+\-−]?[\d.]+) compared with your current rotation\))?\.$/,
    (_, rank, total, score, d) =>
      `ফিল্টার পার হওয়া ${num(total)}টি বিকল্পের মধ্যে ${num(rank)} নম্বর, স্কোর ${num(score)}${
        d != null
          ? ` (বর্তমান পর্যায়ের তুলনায় ${num(d.replace("-", "−"))} পয়েন্ট)`
          : ""
      }।`,
  ],
];

// Returns the Bangla text, or null when there is none (the caller decides what to show).
export function trOrNull(text, language) {
  if (language !== "bn" || typeof text !== "string") return null;
  const key = text.trim();
  if (EXACT[key]) return EXACT[key];
  for (const [re, fn] of PATTERNS) {
    const m = key.match(re);
    if (m) return fn(...m);
  }
  return null;
}

// Bangla when available; otherwise the original text, so a caveat is never silently dropped.
export function tr(text, language) {
  return trOrNull(text, language) ?? text;
}

export const trList = (list, language) =>
  Array.isArray(list) ? list.map((x) => tr(x, language)) : [];

export const hasBn = (text) => trOrNull(text, "bn") !== null;

// Field names that appear in validation errors, in plain Bangla.
export const FIELD_LABELS_BN = {
  name: "জমির নাম",
  districtId: "জেলা",
  district: "জেলা",
  boundary: "সীমানা",
  "boundary.coordinates": "সীমানা",
  soilType: "মাটির ধরন",
  soilPh: "মাটির pH",
  organicMatterPct: "জৈব পদার্থ",
  salinityDsM: "লবণাক্ততা",
  irrigationSource: "সেচের উৎস",
  existingRotation: "ফসলের পর্যায়",
  irrigation: "সেচ",
  "soil.salinity": "লবণাক্ততা",
  "soil.drainage": "পানি নিষ্কাশন",
  usualFrom: "শুরুর তারিখ",
  usualTo: "শেষের তারিখ",
  crop: "ফসল",
  fieldId: "জমি",
  body: "পাঠানো তথ্য",
};

// Bangla for an API error code, used when the English message has no translation.
export const ERROR_CODES_BN = {
  DISTRICT_NOT_FOUND: "জেলাটি পাওয়া যায়নি।",
  FIELD_NOT_FOUND: "জমিটি পাওয়া যায়নি।",
  FIELD_ALREADY_EXISTS: "এই নামে একটি জমি আগে থেকেই আছে।",
  NO_REAL_CLIMATE_DATA: "এই জেলার জন্য NASA POWER-এর প্রকৃত তথ্য এখনো নেই।",
  CLIMATE_CELL_NOT_INGESTED:
    "এই জমির এলাকার জলবায়ু তথ্য এখনো সংগ্রহ করা হয়নি।",
  IMERG_CELL_NOT_INGESTED: "এই জমির এলাকার বৃষ্টির তথ্য এখনো সংগ্রহ করা হয়নি।",
  IMERG_PIXEL_NOT_INGESTED:
    "এই জমির এলাকার বৃষ্টির তথ্য এখনো সংগ্রহ করা হয়নি।",
  RATE_LIMITED: "অনেক বেশি অনুরোধ হয়েছে। একটু অপেক্ষা করে আবার চেষ্টা করুন।",
  ORIGIN_NOT_ALLOWED: "এই উৎস থেকে অনুরোধ অনুমোদিত নয়।",
  BAD_JSON: "পাঠানো তথ্যের ধরন সঠিক নয়।",
  PAYLOAD_TOO_LARGE: "পাঠানো তথ্য অনেক বড়।",
  INTERNAL_ERROR: "সার্ভারে একটি সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
  SERVICE_UNAVAILABLE:
    "সেবাটি এখন পাওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
  DATABASE_NOT_CONFIGURED:
    "তথ্যভান্ডার এখন প্রস্তুত নয়। একটু পরে আবার চেষ্টা করুন।",
  DATABASE_UNREACHABLE:
    "তথ্যভান্ডারে যোগাযোগ করা যায়নি। একটু পরে আবার চেষ্টা করুন।",
  OFFLINE_MODE: "অফলাইন ফাইল থেকে তথ্য দেওয়া হচ্ছে।",
  NOT_FOUND: "এই সেবাটি এখন পাওয়া যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
  VALIDATION_ERROR: "দেওয়া তথ্য যাচাই করে আবার চেষ্টা করুন।",
};

// Dashboard / data-status words the API returns as codes.
export const STATUS_WORDS = {
  en: {
    database: "Database",
    "offline-files": "Offline files",
    "database-with-offline-fallback": "Database with offline fallback",
    nasa: "NASA",
    synthetic: "Synthetic",
    none: "None",
    cached: "Cached",
    demo: "Demo",
    unavailable: "Unavailable",
    not_checked: "Not checked",
    ok: "OK",
    degraded: "Degraded / fallback",
    "field-shift-backend": "Aboho backend",
    "NASA POWER": "NASA POWER",
  },
  bn: {
    database: "ডেটাবেস",
    "offline-files": "অফলাইন ফাইল",
    "database-with-offline-fallback": "ডেটাবেস ও অফলাইন বিকল্প",
    nasa: "NASA",
    synthetic: "সিন্থেটিক",
    none: "কোনোটিই নয়",
    cached: "ক্যাশ করা",
    demo: "ডেমো",
    unavailable: "উপলভ্য নয়",
    not_checked: "পরীক্ষা করা হয়নি",
    ok: "ঠিক আছে",
    degraded: "সীমিত / বিকল্প মোড",
    "field-shift-backend": "আবহ ব্যাকএন্ড",
    "NASA POWER": "NASA POWER",
  },
};

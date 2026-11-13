// Turns a planting-window result into one plain sentence in English and Bangla.
// Pure function. Every number in the text is taken from the computed result; nothing is typed in.
// The wording never claims more than the decision rule allowed (see decideShift).
//
// The Bangla text is a first draft and must be reviewed by a native speaker before it is shown to farmers.

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const SOURCE_CAVEAT_EN = ' This rests on one modelled rainfall source (NASA POWER) that has not been checked against another dataset.';
export const SOURCE_CAVEAT_BN = ' এটি একটি মডেলভিত্তিক বৃষ্টির উৎসের (NASA POWER) ওপর নির্ভরশীল, যা অন্য কোনো তথ্যভাণ্ডারের সঙ্গে যাচাই করা হয়নি।';

// Used instead of the caveat above when a second rainfall source (CHIRPS) has actually been compared.
export const SECOND_SOURCE_SAME_EN = ' This rests on modelled rainfall (NASA POWER); a second rainfall source (CHIRPS) gave the same conclusion.';
export const SECOND_SOURCE_SAME_BN = ' এটি মডেলভিত্তিক বৃষ্টির তথ্যের (NASA POWER) ওপর নির্ভরশীল; দ্বিতীয় একটি বৃষ্টির উৎস (CHIRPS)-ও একই সিদ্ধান্তে পৌঁছেছে।';
export const SECOND_SOURCE_DIFFERENT_EN = ' This rests on modelled rainfall (NASA POWER); a second rainfall source (CHIRPS) gave a different conclusion, so treat it with extra caution.';
export const SECOND_SOURCE_DIFFERENT_BN = ' এটি মডেলভিত্তিক বৃষ্টির তথ্যের (NASA POWER) ওপর নির্ভরশীল; দ্বিতীয় একটি বৃষ্টির উৎস (CHIRPS) ভিন্ন সিদ্ধান্তে পৌঁছেছে, তাই বাড়তি সতর্কতা নিন।';

// The source note for a sentence: the one-source caveat, or what the CHIRPS comparison found.
export function sourceCaveats(crossCheck) {
  if (!crossCheck || typeof crossCheck.sameVerdict !== 'boolean') return { en: SOURCE_CAVEAT_EN, bn: SOURCE_CAVEAT_BN };
  return crossCheck.sameVerdict
    ? { en: SECOND_SOURCE_SAME_EN, bn: SECOND_SOURCE_SAME_BN }
    : { en: SECOND_SOURCE_DIFFERENT_EN, bn: SECOND_SOURCE_DIFFERENT_BN };
}

export function toBnDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

// 'delay' | 'advance' | 'weak' | 'saturated' | 'no_change' | 'insufficient_data' | 'not_applicable'
export function advisoryKind(recommendation) {
  if (recommendation.action === 'delay') return 'delay';
  if (recommendation.action === 'advance') return 'advance';
  switch (recommendation.reason) {
    case 'onset_not_applicable': return 'not_applicable';
    case 'insufficient_data': return 'insufficient_data';
    case 'sensitive_to_definition': return 'weak';
    case 'start_boundary_saturated': return 'saturated';
    case 'no_distinguishable_shift': return 'no_change';
    default: throw new Error(`Unknown recommendation reason "${recommendation.reason}".`);
  }
}

export function buildAdvisory({ districtEn, districtBn, cropEn, cropBn, recommendation, periods, crossCheck = null }) {
  const kind = advisoryKind(recommendation);
  const n = recommendation.shiftDays;
  const early = periods ? `${periods.early.from}–${periods.early.to}` : '';
  const late = periods ? `${periods.late.from}–${periods.late.to}` : '';
  const earlyBn = toBnDigits(early);
  const lateBn = toBnDigits(late);
  const nBn = toBnDigits(n);
  const headEn = `${cropEn} in ${districtEn}:`;
  const headBn = `${districtBn} জেলায় ${cropBn}:`;
  const { en: sourceEn, bn: sourceBn } = sourceCaveats(crossCheck);

  const text = {
    delay: {
      en: `${headEn} usable rain has started about ${n} days later in ${late} than in ${early}. Consider moving transplanting about ${n} days later, and check with your local agricultural extension officer.${sourceEn}`,
      bn: `${headBn} ${earlyBn} সালের তুলনায় ${lateBn} সালে কার্যকর বৃষ্টি প্রায় ${nBn} দিন দেরিতে শুরু হয়েছে। রোপণের সময় প্রায় ${nBn} দিন পিছিয়ে নেওয়ার কথা ভাবুন এবং স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।${sourceBn}`,
    },
    advance: {
      en: `${headEn} usable rain has started about ${n} days earlier in ${late} than in ${early}. Consider preparing the field and sowing about ${n} days earlier, and check with your local agricultural extension officer.${sourceEn}`,
      bn: `${headBn} ${earlyBn} সালের তুলনায় ${lateBn} সালে কার্যকর বৃষ্টি প্রায় ${nBn} দিন আগে শুরু হয়েছে। জমি প্রস্তুত ও বপন প্রায় ${nBn} দিন আগে করার কথা ভাবুন এবং স্থানীয় কৃষি সম্প্রসারণ কর্মকর্তার পরামর্শ নিন।${sourceBn}`,
    },
    no_change: {
      en: `${headEn} no clear change in when usable rain starts was found between ${early} and ${late}. Nothing here suggests changing your usual planting time.`,
      bn: `${headBn} ${earlyBn} ও ${lateBn} সালের মধ্যে কার্যকর বৃষ্টি শুরুর সময়ে স্পষ্ট কোনো পরিবর্তন পাওয়া যায়নি। চিরাচরিত রোপণের সময় বদলানোর মতো কোনো প্রমাণ নেই।`,
    },
    weak: {
      en: `${headEn} some change in the start of the rains was seen, but it depends on how the start of rain is defined, so rainfall data alone does not support changing your planting time.`,
      bn: `${headBn} বৃষ্টি শুরুর সময়ে কিছু পরিবর্তন দেখা গেলেও তা "কার্যকর বৃষ্টি"র সংজ্ঞার ওপর নির্ভরশীল। তাই শুধু বৃষ্টির তথ্যের ভিত্তিতে রোপণের সময় বদলানোর পরামর্শ দেওয়া হচ্ছে না।`,
    },
    saturated: {
      en: `${headEn} in many years the rains had already begun by the first day this analysis can examine, so an earlier change cannot be measured and a finding of "no change" is not reliable. No planting advice is given.`,
      bn: `${headBn} অনেক বছরেই বিশ্লেষণে পরীক্ষা করা প্রথম দিনেই বৃষ্টি শুরু হয়ে গিয়েছিল, তাই আগের দিকের কোনো পরিবর্তন মাপা যায় না এবং "পরিবর্তন নেই" সিদ্ধান্ত নির্ভরযোগ্য নয়। কোনো রোপণ পরামর্শ দেওয়া হচ্ছে না।`,
    },
    insufficient_data: {
      en: `${headEn} there are not enough years of usable data to compare two periods, so no planting advice can be given.`,
      bn: `${headBn} দুই সময়কাল তুলনা করার মতো পর্যাপ্ত বছরের তথ্য নেই, তাই রোপণের কোনো পরামর্শ দেওয়া যাচ্ছে না।`,
    },
    not_applicable: {
      en: `${headEn} no rainfall-onset advice is defined for this crop.`,
      bn: `${headBn} এই ফসলের জন্য বৃষ্টি শুরুর সময়ভিত্তিক কোনো পরামর্শ নির্ধারিত নেই।`,
    },
  }[kind];

  return { kind, en: text.en, bn: text.bn, reviewStatus: 'BANGLA_DRAFT_NOT_NATIVE_REVIEWED' };
}
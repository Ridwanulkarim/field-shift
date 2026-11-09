// SMS-length version of the farmer advisory, in English and Bangla. Pure functions: no database, no HTTP, no clock.
//
// Every number is taken from the computed advisory (shift, years, interval, dates); nothing is typed in. Each message
// is chosen from a list of variants, most informative first, and the first one that fits SMS_MAX_CHARS is used, so a
// long district name shortens the message instead of overflowing it. The last variant of every kind is the shortest
// and is tested to fit with the longest district and crop names.
//
// SMS length facts (GSM 03.38 / UCS-2), because "160 characters" is only true for some text:
//   English (basic GSM-7 alphabet): 160 characters in one message, 153 per part when joined.
//   Bangla is not in the GSM-7 alphabet, so the phone sends it as UCS-2: 70 characters in one message, 67 per part
//   when joined. A 160-character Bangla text therefore costs 3 SMS parts. `segments` below is computed, not assumed.
// The English text is kept to plain ASCII on purpose: one accented letter or dash would silently switch a message
// to UCS-2 and cut its capacity to 70.
//
// The Bangla text is a first draft and must be reviewed by a native speaker before it is sent to farmers.

import { toBnDigits } from './plantingAdvisory.js';

export const SMS_MAX_CHARS = 160;

// Plain GSM-7 basic alphabet check, enough for the ASCII we produce (letters, digits, space and these marks).
const GSM7_ASCII = /^[A-Za-z0-9 .,:;!?'"()%+\-/=<>@#&*\n]*$/;

export function smsStats(text) {
  const isGsm7 = GSM7_ASCII.test(text);
  const length = text.length; // UTF-16 units, which is exactly how UCS-2 SMS length is counted for Bangla
  const single = isGsm7 ? 160 : 70;
  const part = isGsm7 ? 153 : 67;
  return {
    length,
    encoding: isGsm7 ? 'GSM-7' : 'UCS-2',
    segments: length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / part),
    fitsOneSms: length <= single,
    within160Characters: length <= SMS_MAX_CHARS,
  };
}

const dayWord = (n) => (n === 1 ? 'day' : 'days');
const range = (p) => `${p.from}-${p.to}`; // ASCII hyphen, never an en dash (an en dash would force UCS-2)

// How far from the estimate the data cannot rule out, as one whole number of days (largest absolute end of the 95% interval).
function uncertaintyDays(estimate) {
  if (!estimate) return null;
  const [lo, hi] = estimate.interval95Days;
  const u = Math.max(Math.abs(Math.floor(lo)), Math.abs(Math.ceil(hi)));
  return u > 0 ? u : null; // an interval of exactly 0 days (identical years) has no "cannot be ruled out" range to state
}

// ctx: { kind, district:{en,bn}, crop:{en,bn}, n, periods, estimate, experimental,
//        window: null | { en: { usual, revised }, bn: { usual, revised } } }   (dates already formatted by the caller,
//        which avoids a circular import with farmerAdvisory.js)
function variantsEn(ctx) {
  const { kind, district: d, crop: c, n, periods, estimate, window, experimental } = ctx;
  const head = `${experimental ? 'EXPERIMENTAL. ' : ''}${d.en} ${c.en}:`;
  const w = window?.en ?? null;
  const u = uncertaintyDays(estimate);
  const late = periods ? range(periods.late) : '';
  const early = periods ? range(periods.early) : '';
  switch (kind) {
    case 'delay':
    case 'advance': {
      const dir = kind === 'delay' ? 'later' : 'earlier';
      return [
        `${head} usable rain now starts about ${n} ${dayWord(n)} ${dir} (${late} vs ${early}).${w ? ` Your ${w.usual}: consider ${w.revised}.` : ` Consider planting about ${n} ${dayWord(n)} ${dir}.`} Ask your extension officer.`,
        `${head} usable rain starts about ${n} ${dayWord(n)} ${dir} since ${periods?.early.from}. Consider planting ${n} ${dayWord(n)} ${dir}. Ask your extension officer.`,
        `${head} rain starts ~${n} ${dayWord(n)} ${dir}. Consider planting ${n} ${dayWord(n)} ${dir}. Ask extension officer.`,
      ];
    }
    case 'no_change':
      return [
        `${head} no clear change in when usable rain starts (${early} vs ${late})${u === null ? '' : `; a shift of up to ${u} ${dayWord(u)} cannot be ruled out`}. Keep your usual planting time.`,
        `${head} no clear change in when usable rain starts${u === null ? '' : `; up to ${u} ${dayWord(u)} cannot be ruled out`}. Keep your usual planting time.`,
        `${head} no clear change in rain start. Keep usual planting time.`,
      ];
    case 'weak':
      return [
        `${head} some change in the start of rains, but it depends on how rain start is defined. No advice to change planting time.`,
        `${head} unclear change in rain start. No advice to change planting time.`,
      ];
    case 'saturated':
      return [
        `${head} rains often began before the first day we can check, so change cannot be measured. No planting advice.`,
        `${head} change cannot be measured. No planting advice.`,
      ];
    case 'insufficient_data':
      return [`${head} not enough years of data to compare. No planting advice.`, `${head} not enough data. No advice.`];
    case 'not_applicable':
      return [`${head} no rain-start advice exists for this crop.`, `${head} no advice for this crop.`];
    default:
      throw new Error(`Unknown advisory kind "${kind}".`);
  }
}

function variantsBn(ctx) {
  const { kind, district: d, crop: c, n, periods, estimate, window, experimental } = ctx;
  const head = `${experimental ? 'পরীক্ষামূলক। ' : ''}${d.bn} ${c.bn}:`;
  const w = window?.bn ?? null;
  const u = uncertaintyDays(estimate);
  const N = toBnDigits(n);
  const U = u === null ? null : toBnDigits(u);
  const late = periods ? toBnDigits(range(periods.late)) : '';
  const early = periods ? toBnDigits(range(periods.early)) : '';
  switch (kind) {
    case 'delay':
    case 'advance': {
      const dir = kind === 'delay' ? 'দেরিতে' : 'আগে';
      const verb = kind === 'delay' ? 'পিছিয়ে' : 'এগিয়ে';
      return [
        `${head} কার্যকর বৃষ্টি এখন প্রায় ${N} দিন ${dir} শুরু (${late} বনাম ${early})।${w ? ` আপনার ${w.usual}: ভাবুন ${w.revised}।` : ` রোপণ প্রায় ${N} দিন ${verb} নেওয়ার কথা ভাবুন।`} কৃষি কর্মকর্তার পরামর্শ নিন।`,
        `${head} কার্যকর বৃষ্টি প্রায় ${N} দিন ${dir} শুরু। রোপণ ${N} দিন ${verb} নেওয়ার কথা ভাবুন। কৃষি কর্মকর্তার পরামর্শ নিন।`,
        `${head} বৃষ্টি ~${N} দিন ${dir}। রোপণ ${N} দিন ${verb} ভাবুন। কৃষি কর্মকর্তাকে জিজ্ঞাসা করুন।`,
      ];
    }
    case 'no_change':
      return [
        `${head} বৃষ্টি শুরুর সময়ে স্পষ্ট পরিবর্তন নেই (${early} বনাম ${late})${U === null ? '' : `; ${U} দিন পর্যন্ত পরিবর্তন বাদ দেওয়া যায় না`}। চিরাচরিত সময়ই রাখুন।`,
        `${head} বৃষ্টি শুরুর সময়ে স্পষ্ট পরিবর্তন নেই${U === null ? '' : `; ${U} দিন পর্যন্ত বাদ দেওয়া যায় না`}। চিরাচরিত সময়ই রাখুন।`,
        `${head} বৃষ্টি শুরুর স্পষ্ট পরিবর্তন নেই। চিরাচরিত সময়ই রাখুন।`,
      ];
    case 'weak':
      return [
        `${head} বৃষ্টি শুরুতে কিছু পরিবর্তন দেখা গেছে, তবে তা সংজ্ঞার ওপর নির্ভরশীল। রোপণ বদলানোর পরামর্শ নেই।`,
        `${head} পরিবর্তন অস্পষ্ট। রোপণ বদলানোর পরামর্শ নেই।`,
      ];
    case 'saturated':
      return [
        `${head} অনেক বছর পরীক্ষার প্রথম দিনেই বৃষ্টি শুরু, তাই পরিবর্তন মাপা যায় না। রোপণ পরামর্শ নেই।`,
        `${head} পরিবর্তন মাপা যায় না। রোপণ পরামর্শ নেই।`,
      ];
    case 'insufficient_data':
      return [`${head} তুলনার মতো যথেষ্ট বছরের তথ্য নেই। রোপণ পরামর্শ নেই।`, `${head} যথেষ্ট তথ্য নেই। পরামর্শ নেই।`];
    case 'not_applicable':
      return [`${head} এই ফসলের জন্য বৃষ্টি শুরুর পরামর্শ নেই।`, `${head} এই ফসলের পরামর্শ নেই।`];
    default:
      throw new Error(`Unknown advisory kind "${kind}".`);
  }
}

function pick(variants, fallback) {
  for (const text of variants) if (text.length <= SMS_MAX_CHARS) return text;
  return fallback; // a name so long that even the shortest variant overflows: say less, never overflow
}

// Returns { en, bn, meta: { en: smsStats, bn: smsStats } }. `kind` is the advisory kind from plantingAdvisory.js.
export function buildSms(ctx) {
  const en = pick(variantsEn(ctx), ctx.kind === 'no_change' ? 'No clear change in rain start. Keep usual planting time.' : 'See the full advisory. Ask your extension officer.');
  const bn = pick(variantsBn(ctx), ctx.kind === 'no_change' ? 'বৃষ্টি শুরুর স্পষ্ট পরিবর্তন নেই। চিরাচরিত সময় রাখুন।' : 'পূর্ণ পরামর্শ দেখুন। কৃষি কর্মকর্তাকে জিজ্ঞাসা করুন।');
  return { en, bn, meta: { en: smsStats(en), bn: smsStats(bn) } };
}

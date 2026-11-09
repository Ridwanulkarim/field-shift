// SMS-length advisory: every message is at most 160 characters, English stays plain GSM-7, Bangla reports its real
// SMS cost, and every number in a message is taken from the computed advisory.
// The climate data are hand-built TEST FIXTURES ("NASA POWER" is only a label); none of these numbers is a NASA observation.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';
import { buildSms, smsStats, SMS_MAX_CHARS } from '../src/science/smsAdvisory.js';
import { EXPERIMENTAL_CROPS } from '../src/science/rules.js';

const KINDS = ['delay', 'advance', 'no_change', 'weak', 'saturated', 'insufficient_data', 'not_applicable'];
const periods = { early: { from: 2001, to: 2012 }, late: { from: 2013, to: 2025 } };
const base = {
  district: { en: 'Rajshahi', bn: 'রাজশাহী' },
  crop: { en: 'Aman rice', bn: 'আমন ধান' },
  n: 11,
  periods,
  estimate: { interval95Days: [-8.4, 7.6] },
  window: null,
  experimental: false,
};

describe('smsStats', () => {
  it('counts plain ASCII as GSM-7: 160 in one SMS, 153 per part when joined', () => {
    expect(smsStats('a'.repeat(160))).toMatchObject({ encoding: 'GSM-7', segments: 1, fitsOneSms: true });
    expect(smsStats('a'.repeat(161))).toMatchObject({ encoding: 'GSM-7', segments: 2, fitsOneSms: false });
    expect(smsStats('a'.repeat(306)).segments).toBe(2);
    expect(smsStats('a'.repeat(307)).segments).toBe(3);
  });
  it('counts Bangla as UCS-2: 70 in one SMS, 67 per part when joined', () => {
    expect(smsStats('ক'.repeat(70))).toMatchObject({ encoding: 'UCS-2', segments: 1, fitsOneSms: true });
    expect(smsStats('ক'.repeat(71))).toMatchObject({ encoding: 'UCS-2', segments: 2 });
    expect(smsStats('ক'.repeat(160)).segments).toBe(3);
  });
  it('treats one non-GSM character (an en dash) as UCS-2, which is why the English text avoids them', () => {
    expect(smsStats('2001–2012').encoding).toBe('UCS-2');
  });
});

describe('buildSms', () => {
  it.each(KINDS)('keeps the %s message within 160 characters in both languages, English as plain GSM-7', (kind) => {
    const sms = buildSms({ ...base, kind });
    expect(sms.en.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    expect(sms.bn.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    expect(sms.meta.en.encoding).toBe('GSM-7');
    expect(sms.meta.bn.encoding).toBe('UCS-2');
    expect(sms.meta.en.within160Characters).toBe(true);
    expect(sms.meta.bn.within160Characters).toBe(true);
    expect(sms.en.length).toBeGreaterThan(20);
    expect(sms.bn.length).toBeGreaterThan(20);
  });

  it('states the computed shift, never a typed-in number, for a delay and an advance', () => {
    for (const n of [3, 11, 24]) {
      const delay = buildSms({ ...base, kind: 'delay', n });
      expect(delay.en).toContain(`${n} days later`);
      expect(delay.bn).toContain(String(n).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[d]));
      const advance = buildSms({ ...base, kind: 'advance', n });
      expect(advance.en).toContain(`${n} days earlier`);
    }
  });

  it('says "no clear change" with the uncertainty the data cannot rule out, and gives no shift in days as a finding', () => {
    const sms = buildSms({ ...base, kind: 'no_change' });
    expect(sms.en).toMatch(/no clear change/);
    expect(sms.en).toMatch(/up to 9 days cannot be ruled out/); // max(|floor(-8.4)|, |ceil(7.6)|) = 9
    expect(sms.en).not.toMatch(/days (later|earlier)/);
    expect(sms.bn).toContain('৯ দিন');
  });

  it('uses the singular for one day', () => {
    expect(buildSms({ ...base, kind: 'no_change', estimate: { interval95Days: [-1, 1] } }).en).toMatch(/up to 1 day cannot/);
    expect(buildSms({ ...base, kind: 'delay', n: 1 }).en).toMatch(/about 1 day later/);
  });

  it('omits the uncertainty clause when no interval is available instead of inventing one', () => {
    const sms = buildSms({ ...base, kind: 'no_change', estimate: null });
    expect(sms.en).not.toMatch(/cannot be ruled out/);
    expect(sms.en).toMatch(/Keep your usual planting time/);
  });

  it("includes the farmer's own window moved by the shift when one is given and it fits", () => {
    const window = {
      en: { usual: '15 Jul-15 Aug', revised: '26 Jul-26 Aug' },
      bn: { usual: '১৫ জুলাই-১৫ আগস্ট', revised: '২৬ জুলাই-২৬ আগস্ট' },
    };
    const sms = buildSms({ ...base, kind: 'delay', window });
    expect(sms.en).toContain('15 Jul-15 Aug');
    expect(sms.en).toContain('26 Jul-26 Aug');
    expect(sms.en.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });

  it('marks an experimental result as EXPERIMENTAL in both languages', () => {
    const sms = buildSms({ ...base, kind: 'delay', experimental: true });
    expect(sms.en.startsWith('EXPERIMENTAL.')).toBe(true);
    expect(sms.bn.startsWith('পরীক্ষামূলক।')).toBe(true);
    expect(sms.en.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
  });

  it('shortens, and never overflows, for an absurdly long district name', () => {
    const long = 'X'.repeat(90);
    for (const kind of KINDS) {
      const sms = buildSms({ ...base, kind, district: { en: long, bn: 'ক'.repeat(90) } });
      expect(sms.en.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
      expect(sms.bn.length).toBeLessThanOrEqual(SMS_MAX_CHARS);
    }
  });

  it('fits for every pilot district and every crop in the reference tables, for every kind', () => {
    for (const d of DISTRICTS) {
      for (const c of CROPS) {
        for (const kind of KINDS) {
          const sms = buildSms({ ...base, kind, district: { en: d.nameEn, bn: d.nameBn }, crop: { en: c.nameEn, bn: c.nameBn }, experimental: true });
          expect(sms.en.length, `${d.slug}/${c.slug}/${kind} en`).toBeLessThanOrEqual(SMS_MAX_CHARS);
          expect(sms.bn.length, `${d.slug}/${c.slug}/${kind} bn`).toBeLessThanOrEqual(SMS_MAX_CHARS);
        }
      }
    }
  });

  it('rejects an unknown kind instead of guessing', () => {
    expect(() => buildSms({ ...base, kind: 'bogus' })).toThrow(/Unknown advisory kind/);
  });
});

// ---- through the real route -------------------------------------------------------------------------------------

const shifted = () => buildSeries(2001, 2025, (y, m, d) => {
  const startDay = y < 2013 ? 10 + (y % 4) : 27 + (y % 4);
  const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
  return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
});
const unchanged = () => buildSeries(2001, 2025, (y, m, d) => {
  const startDay = 10 + (y % 4);
  const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
  return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
});
function app(series) {
  const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
  const repository = {
    ping: async () => true,
    listDistricts: async () => districts,
    getDistrictBySlug: async (slug) => districts.find((d) => d.slug === slug) ?? null,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
    getClimate: async () => ({
      provenance: { runId: 7, source: 'NASA POWER', isSynthetic: false, retrievedAt: '2026-11-02T16:55:22.041Z', startDate: '2001-01-01', endDate: '2025-12-31', units: {} },
      series,
    }),
  };
  return createApp(loadConfig({}), { repository });
}

describe('GET /api/districts/:slug/advisory -> sentence.sms', () => {
  it('returns sentence.sms in English and Bangla, each at most 160 characters', async () => {
    const res = await request(app(shifted())).get('/api/districts/rajshahi/advisory?crop=aman');
    expect(res.status).toBe(200);
    const { sms } = res.body.sentence;
    expect(sms.en.length).toBeLessThanOrEqual(160);
    expect(sms.bn.length).toBeLessThanOrEqual(160);
    expect(sms.en).toMatch(/17 days later/); // the same 17 the full sentence reports
    expect(sms.meta.en.encoding).toBe('GSM-7');
    expect(sms.meta.bn.segments).toBeGreaterThanOrEqual(1);
  });

  it('reports the honest no-change result with its uncertainty when nothing shifted', async () => {
    const res = await request(app(unchanged())).get('/api/districts/rajshahi/advisory?crop=aman');
    expect(res.status).toBe(200);
    expect(res.body.decision.action).toBe('none');
    expect(res.body.sentence.sms.en).toMatch(/no clear change/i);
    expect(res.body.sentence.sms.en).not.toMatch(/days (later|earlier)/);
  });

  it('uses the farmer\'s own window in the SMS when usualFrom and usualTo are given', async () => {
    const res = await request(app(shifted())).get('/api/districts/rajshahi/advisory?crop=aman&usualFrom=07-15&usualTo=08-15');
    expect(res.status).toBe(200);
    expect(res.body.sentence.sms.en.length).toBeLessThanOrEqual(160);
    expect(res.body.sentence.sms.en).toContain('15 Jul');
  });
});

describe('Aus is labelled experimental', () => {
  it('has an experimental note in rules for aus and none for aman', () => {
    expect(EXPERIMENTAL_CROPS.aus.en).toMatch(/Experimental/);
    expect(EXPERIMENTAL_CROPS.aus.bn.length).toBeGreaterThan(20);
    expect(EXPERIMENTAL_CROPS.aman).toBeUndefined();
  });

  it('marks the Aus advisory experimental in the decision, warnings and SMS, and leaves Aman unmarked', async () => {
    const a = app(shifted());
    const aus = await request(a).get('/api/districts/rajshahi/advisory?crop=aus');
    expect(aus.status).toBe(200);
    expect(aus.body.decision.experimental).toBe(true);
    expect(aus.body.warnings[0]).toMatchObject({ code: 'EXPERIMENTAL_CROP' });
    expect(aus.body.sentence.sms.en.startsWith('EXPERIMENTAL.')).toBe(true);
    const aman = await request(a).get('/api/districts/rajshahi/advisory?crop=aman');
    expect(aman.body.decision.experimental).toBe(false);
    expect(aman.body.warnings).toEqual([]);
    expect(aman.body.sentence.sms.en.startsWith('EXPERIMENTAL.')).toBe(false);
  });
});

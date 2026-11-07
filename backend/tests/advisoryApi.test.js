// API and unit tests for GET /api/districts/:slug/advisory.
// The repository is a FAKE with hand-built climate fixtures ("NASA POWER" below is a test label only);
// none of these numbers is a NASA observation.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';
import { buildSeries } from './helpers/series.js';
import { parseAdvisoryRequest } from '../src/validation/advisoryRequest.js';
import { monthDayFromDay365, parseMonthDay, shiftMonthDay, formatMonthDay, quantile, summarize, onsetDistributions } from '../src/science/farmerAdvisory.js';

// Rain starts 10-13 June in 2001-2012 and 27-30 June in 2013-2025 (same fixture as the planting-window tests).
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

function repo({ climate = 'real', series = shifted() } = {}) {
  const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
  return {
    ping: async () => true,
    listDistricts: async () => districts,
    getDistrictBySlug: async (slug) => districts.find((d) => d.slug === slug) ?? null,
    listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
    getClimate: async () => (climate === 'none' ? null : {
      provenance: { runId: 7, source: climate === 'synthetic' ? 'SYNTHETIC' : 'NASA POWER', isSynthetic: climate === 'synthetic', retrievedAt: '2026-11-02T16:55:22.041Z', startDate: '2001-01-01', endDate: '2025-12-31', units: {} },
      series,
    }),
  };
}
const app = (opts) => createApp(loadConfig({}), { repository: repo(opts) });
const URL = (q = 'crop=aman') => `/api/districts/rajshahi/advisory?${q}`;

describe('GET /api/districts/:slug/advisory', () => {
  it('returns the decision, both distributions, the sentence and provenance for a supported delay', async () => {
    const res = await request(app()).get(URL());
    expect(res.status).toBe(200);
    expect(res.body.decision).toMatchObject({ action: 'delay', direction: 'later', shiftDays: 17, confidence: 'supported', kind: 'delay' });
    const { early, late } = res.body.evidence.distributions;
    expect(early.summary.n).toBe(12);
    expect(late.summary.n).toBe(13);
    expect(early.valuesDayOfYear).toHaveLength(12);
    expect(late.summary.median).toBeGreaterThan(early.summary.median);
    expect(res.body.evidence.strength.pValue).toBeLessThan(0.05);
    expect(res.body.evidence.strength.pValueText).toBe('less than 0.0001');
    expect(res.body.evidence.strength.startBoundary).toMatchObject({ saturated: false, saturatedShareThreshold: 0.5 });
    expect(res.body.evidence.strength.startBoundary.earlyShareAtFirstDay).toEqual(expect.any(Number));
    expect(res.body.evidence.onsetDates.earlyMedian).toMatch(/^06-\d{2}$/);
    expect(res.body.evidence.onsetDates.lateMedian).toMatch(/^(06|07)-\d{2}$/);
    expect(res.body.sentence.en).toMatch(/about 17 days later/);
    expect(res.body.sentence.bn).toMatch(/১৭ দিন দেরিতে/);
    expect(res.body.sentence.text).toBe(res.body.sentence.en);
    expect(res.body.sentence.reviewStatus).toBe('BANGLA_DRAFT_NOT_NATIVE_REVIEWED');
    expect(res.body.window).toBeNull();
    expect(res.body.windowHint).toMatch(/usualFrom/);
    expect(res.body.provenance).toMatchObject({ runId: 7, source: 'NASA POWER', isSynthetic: false });
    expect(res.body.crop.basis).toBe('UNVERIFIED_GENERAL_KNOWLEDGE');
    expect(res.body.limitations.length).toBeGreaterThan(3);
    expect(res.body.evidence.heat).toBeNull(); // growing degree days are opt-in
    expect(res.body.evidence.heatNote).toMatch(/includeHeat=true/);
    expect(res.body.statusNote).toMatch(/excluded from the decision/);
    expect(res.body.decision.confidenceMeaning).toMatch(/at least 60%/);
  });

  it('puts the Bangla sentence in text when lang=bn, and always returns both', async () => {
    const res = await request(app()).get(URL('crop=aman&lang=bn'));
    expect(res.body.sentence.text).toBe(res.body.sentence.bn);
    expect(res.body.sentence.lang).toBe('bn');
    expect(res.body.sentence.en).toBeTruthy();
  });

  it('moves the farmer-entered usual window by exactly the supported shift', async () => {
    const res = await request(app()).get(URL('crop=aman&usualFrom=07-15&usualTo=08-15'));
    expect(res.body.window).toMatchObject({ basis: 'farmer_entered_usual_window', usual: { from: '07-15', to: '08-15' }, revised: { from: '08-01', to: '09-01' }, shiftDays: 17, changed: true });
    expect(res.body.sentence.en).toMatch(/15 Jul to 15 Aug, consider 1 Aug to 1 Sep/);
    expect(res.body.sentence.bn).toMatch(/১৫ জুলাই থেকে ১৫ আগস্ট/);
    expect(res.body.windowHint).toBeNull();
    expect(res.body.limitations.join(' ')).toMatch(/not an agronomically derived/);
  });

  it('recommends no change and keeps the usual window when nothing shifted', async () => {
    const res = await request(app({ series: unchanged() })).get(URL('crop=aman&usualFrom=07-15&usualTo=08-15'));
    expect(res.status).toBe(200);
    expect(res.body.decision).toMatchObject({ action: 'none', direction: 'none', shiftDays: 0 });
    expect(res.body.window).toMatchObject({ revised: { from: '07-15', to: '08-15' }, shiftDays: 0, changed: false });
    expect(res.body.sentence.en).toMatch(/no clear change/);
    expect(res.body.sentence.en).toMatch(/usual window stays/);
  });

  it('gives a not-applicable decision with heat evidence for a crop with no onset rule (Boro)', async () => {
    const res = await request(app()).get(URL('crop=boro&includeHeat=true'));
    expect(res.status).toBe(200);
    expect(res.body.decision.kind).toBe('not_applicable');
    expect(res.body.evidence.distributions).toBeNull();
    expect(res.body.evidence.onsetDates).toBeNull();
    expect(res.body.evidence.heat).not.toBeNull();
    expect(res.body.evidence.heat).toMatchObject({ usedInDecision: false, parameterBasis: 'UNVERIFIED_GENERAL_KNOWLEDGE', cropSpecific: false });
    expect(res.body.evidence.heat.note).toMatch(/not sourced/);
  });

  it('is deterministic and supports conditional requests', async () => {
    const a = await request(app()).get(URL());
    const b = await request(app()).get(URL());
    expect(a.body).toEqual(b.body);
    const etag = a.headers.etag;
    expect(etag).toBeTruthy();
    const c = await request(app()).get(URL()).set('If-None-Match', etag);
    expect(c.status).toBe(304);
  });

  it('leaves the planting-window endpoint unchanged', async () => {
    const res = await request(app()).get('/api/districts/rajshahi/planting-window?crop=aman');
    expect(res.status).toBe(200);
    expect(res.body.recommendation).toMatchObject({ action: 'delay', shiftDays: 17 });
    expect(res.body.advisory.kind).toBe('delay');
  });

  it('validates the query with 422 and field names', async () => {
    for (const q of ['', 'crop=aman&lang=fr', 'crop=aman&usualFrom=07-15', 'crop=aman&usualFrom=02-30&usualTo=03-01', 'crop=aman&usualFrom=08-15&usualTo=07-15', 'crop=aman&usualFrom=01-01&usualTo=12-31', 'crop=aman&x=1', 'crop=Aman!', 'crop=aman&includeHeat=yes']) {
      const res = await request(app()).get(URL(q));
      expect(res.status, q).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('404s for an unknown district and when there is no real data, never falling back to demo data', async () => {
    expect((await request(app()).get('/api/districts/nowhere/advisory?crop=aman')).status).toBe(404);
    const none = await request(app({ climate: 'none' })).get(URL());
    expect(none.status).toBe(404);
    expect(none.body.error.code).toBe('NO_REAL_CLIMATE_DATA');
    const syn = await request(app({ climate: 'synthetic' })).get(URL());
    expect(syn.status).toBe(404);
  });
});

describe('request parser', () => {
  it('accepts a full valid query', () => {
    expect(parseAdvisoryRequest({ crop: 'aman', lang: 'bn', split: '2013', usualFrom: '07-15', usualTo: '08-15' })).toEqual({ crop: 'aman', splitYear: 2013, lang: 'bn', usual: { from: '07-15', to: '08-15' }, includeHeat: false });
  });
  it('defaults lang to en and usual to null', () => {
    expect(parseAdvisoryRequest({ crop: 'aman' })).toMatchObject({ lang: 'en', usual: null });
  });
});

describe('date and statistics helpers', () => {
  it('maps day-of-year on the 365-day calendar', () => {
    expect(monthDayFromDay365(1)).toBe('01-01');
    expect(monthDayFromDay365(152)).toBe('06-01'); // 1 June is day 152, as documented in series.js
    expect(monthDayFromDay365(365)).toBe('12-31');
    expect(() => monthDayFromDay365(0)).toThrow(RangeError);
    expect(() => monthDayFromDay365(366)).toThrow(RangeError);
  });
  it('parses and shifts month-days, rejecting impossible dates', () => {
    expect(parseMonthDay('02-29')).toBeNull();
    expect(parseMonthDay('13-01')).toBeNull();
    expect(parseMonthDay('7-15')).toBeNull();
    expect(parseMonthDay('07-15')).toEqual({ month: 7, day: 15 });
    expect(shiftMonthDay('07-15', 17)).toBe('08-01');
    expect(shiftMonthDay('01-05', -10)).toBe('12-26');
    expect(formatMonthDay('08-01', 'en')).toBe('1 Aug');
    expect(formatMonthDay('08-01', 'bn')).toBe('১ আগস্ট');
  });
  it('computes quartiles by interpolation and handles empty input', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(summarize([4, 1, 3, 2])).toMatchObject({ n: 4, min: 1, q1: 1.75, median: 2.5, q3: 3.25, max: 4 });
    expect(summarize([])).toMatchObject({ n: 0, median: null });
  });
  it('counts censored and unknown years separately and keeps them out of the quartiles', () => {
    const d = onsetDistributions([
      { year: 2001, status: 'onset', value: 160 }, { year: 2002, status: 'no_onset' }, { year: 2003, status: 'unknown' },
      { year: 2013, status: 'onset', value: 170 }, { year: 2014, status: 'onset', value: 180, earlierWindowsUnobserved: true },
    ], 2013);
    expect(d.early).toMatchObject({ years: 3, confirmedYears: 1, censoredYears: 1, unknownYears: 1, valuesDayOfYear: [160] });
    expect(d.late).toMatchObject({ confirmedYears: 1, unknownYears: 1, valuesDayOfYear: [170] });
  });
});

// Series whose last year ends part-way: 2001-2025 complete plus 2026 up to `lastIso`.
const partialLast = (lastIso) => buildSeries(2001, 2026, (y, m, d) => {
  const startDay = y < 2013 ? 10 + (y % 4) : 27 + (y % 4);
  const rain = m > 6 || (m === 6 && d >= startDay) ? 10 : 0;
  return { precipMm: m <= 8 ? rain : 0, tMaxC: 32, tMinC: 22 };
}).filter((r) => r.date <= lastIso);

describe('partial final year', () => {
  it('counts 2026 as a full onset year when the data end on 28 October (the Jun-Aug season is complete) but leaves it out of growing degree days', async () => {
    const res = await request(app({ series: partialLast('2026-10-28') })).get(URL('crop=aman&includeHeat=true'));
    expect(res.body.evidence.periods.late).toMatchObject({ from: 2013, to: 2026, years: 14 });
    expect(res.body.evidence.distributions.late.confirmedYears).toBe(14);
    expect(res.body.evidence.excludedYears).toEqual([]);
    // Aman GDD covers July-November: November 2026 is missing, so 2026 is excluded there (13 years, not 14).
    expect(res.body.evidence.heat.late.n).toBe(13);
  });
  it('excludes 2026 and does not label it as part of the late period when the data end before the season is over', async () => {
    const res = await request(app({ series: partialLast('2026-06-05') })).get(URL());
    expect(res.status).toBe(200);
    expect(res.body.evidence.periods.late).toMatchObject({ from: 2013, to: 2025, years: 13 });
    expect(res.body.evidence.excludedYears).toEqual([{ year: 2026, reason: expect.stringMatching(/not fully observed/) }]);
    expect(res.body.sentence.en).toMatch(/2013–2025/);
    expect(res.body.sentence.en).not.toMatch(/2026/);
  });
  it('keeps 2026 when its onset was observed before the data ended (data end 20 July)', async () => {
    const res = await request(app({ series: partialLast('2026-07-20') })).get(URL());
    expect(res.body.evidence.periods.late).toMatchObject({ to: 2026, years: 14 });
  });
});

describe('what "no change" does and does not say', () => {
  it('adds the shifts the data cannot rule out to a no-change sentence, in both languages', async () => {
    const res = await request(app({ series: unchanged() })).get(URL());
    expect(res.body.decision.kind).toBe('no_change');
    expect(res.body.decision.confidenceMeaning).toMatch(/NOT a statement that nothing changed/);
    expect(res.body.evidence.strength.shiftEstimate.interval95Days).toHaveLength(2);
    expect(res.body.sentence.en).toMatch(/cannot be ruled out/);
    expect(res.body.sentence.bn).toMatch(/বাদ দেওয়া যায় না/);
    expect(res.body.evidence.strength.definitionsNote).toMatch(/not independent/);
  });
});

describe('sentence formatting', () => {
  const GLUED = ['rainstarts', 'Yourusual', 'singlemodelled', 'anda ', 'variabilitycan', 'areunverified'];
  it('has no joined-up words in any sentence or limitation, and keeps the spaces the text needs', async () => {
    for (const q of ['crop=aman', 'crop=aman&usualFrom=07-15&usualTo=08-15&lang=bn']) {
      for (const series of [shifted(), unchanged()]) {
        const res = await request(app({ series })).get(URL(q));
        const strings = [res.body.sentence.en, res.body.sentence.bn, res.body.sentence.text, ...res.body.limitations, res.body.statusNote];
        for (const t of strings) {
          for (const g of GLUED) expect(t, g).not.toContain(g);
          expect(t).not.toMatch(/\s{2,}/);
          expect(t).not.toMatch(/[.,;:][A-Za-z]/);
          expect(t).toBe(t.trim());
        }
      }
    }
    const res = await request(app({ series: unchanged() })).get(URL('crop=aman&usualFrom=07-15&usualTo=08-15'));
    expect(res.body.sentence.en).toContain('when usable rain starts');
    expect(res.body.sentence.en).toContain('Your usual window stays');
  });
});

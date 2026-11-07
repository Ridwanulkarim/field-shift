// Soil that was not entered must never be scored as good soil. Climate series here is a hand-built FIXTURE, not NASA data.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { CROPS } from '../src/data/reference/crops.js';
import { cropClimate } from '../src/science/climate.js';
import { scoreRotation, evaluateRotations } from '../src/science/rotation.js';
import { parseEvaluateRequest } from '../src/validation/evaluateRequest.js';
import { buildSeries } from './helpers/series.js';

const crop = (s) => CROPS.find((c) => c.slug === s);
const series = buildSeries(2001, 2020, (y, m) => ({ precipMm: m >= 6 && m <= 10 ? 10 : 0.1, tMaxC: 29, tMinC: 22 }));
const ctx = (soil) => ({
  cropClimate: Object.fromEntries(CROPS.map((c) => [c.slug, cropClimate(series, c)])),
  soil,
  irrigation: 'limited',
  priorities: { waterSaving: 1, heatResilience: 1, soilHealth: 1, diversification: 1, lowInput: 1 },
});
const component = (s, id) => s.components.find((c) => c.id === id);
const rot = [crop('aman'), crop('lentil')];

describe('scoring without soil input', () => {
  it('leaves the soil match out (null) instead of scoring it as perfect', () => {
    const s = scoreRotation(rot, ctx({ salinity: null, drainage: null }));
    expect(component(s, 'soilFit').value).toBeNull();
    expect(s.score).not.toBeNull();
    for (const m of s.metrics) expect(m.soilFit).toBeNull();
  });
  it('does not equal the score of an explicit "none / good" soil, because that is a claim about the soil', () => {
    const missing = scoreRotation(rot, ctx({ salinity: null, drainage: null }));
    const good = scoreRotation(rot, ctx({ salinity: 'none', drainage: 'good' }));
    expect(component(good, 'soilFit').value).toBe(1);
    expect(missing.score).not.toBe(good.score);
  });
  it('scores only the part that was entered', () => {
    const onlySalinity = scoreRotation(rot, ctx({ salinity: 'high', drainage: null }));
    const bothButGoodDrainage = scoreRotation(rot, ctx({ salinity: 'high', drainage: 'good' }));
    expect(component(onlySalinity, 'soilFit').value).toBe(component(bothButGoodDrainage, 'soilFit').value);
    expect(component(onlySalinity, 'soilFit').value).toBeLessThan(1);
    const onlyDrainage = scoreRotation(rot, ctx({ salinity: null, drainage: 'poor' }));
    expect(component(onlyDrainage, 'soilFit').value).toBeLessThan(1);
  });
  it('never calls a crop poorly matched or well matched to soil it knows nothing about', () => {
    const { strategies } = evaluateRotations({ crops: CROPS, existingSlugs: ['aman', 'lentil'], ctx: ctx({ salinity: null, drainage: null }) });
    for (const st of strategies) {
      expect(st.benefits.join(' ')).not.toMatch(/match the soil salinity/);
      expect(st.risks.join(' ')).not.toMatch(/poorly matched to the soil/);
      expect(st.informationGaps.join(' ')).toMatch(/No soil salinity or drainage was entered, so the soil match was left out of the score/);
    }
  });
  it('says which half is missing when only one was entered', () => {
    const { strategies } = evaluateRotations({ crops: CROPS, existingSlugs: ['aman', 'lentil'], ctx: ctx({ salinity: 'slight', drainage: null }) });
    expect(strategies[0].informationGaps.join(' ')).toMatch(/drainage: not entered/);
    expect(strategies[0].informationGaps.join(' ')).toMatch(/drainage match was left out/);
  });
  it('still penalises soil that really is saline', () => {
    const saline = scoreRotation([crop('aman')], ctx({ salinity: 'high', drainage: 'good' }));
    expect(component(saline, 'soilFit').value).toBeLessThan(1);
  });
});

describe('request parsing', () => {
  const valid = { district: 'rajshahi', existingRotation: ['aman'] };
  it('keeps missing soil as null, never as good soil', () => {
    expect(parseEvaluateRequest(valid).soil).toEqual({ salinity: null, drainage: null });
    expect(parseEvaluateRequest({ ...valid, soil: {} }).soil).toEqual({ salinity: null, drainage: null });
    expect(parseEvaluateRequest({ ...valid, soil: { salinity: 'slight' } }).soil).toEqual({ salinity: 'slight', drainage: null });
  });
});

describe('POST /api/evaluate without soil', () => {
  it('reports soil as not entered and says the soil match was not used', async () => {
    const { createApp } = await import('../src/app.js');
    const { loadConfig } = await import('../src/config/env.js');
    const { DISTRICTS } = await import('../src/data/reference/districts.js');
    const districts = DISTRICTS.map((d, i) => ({ id: i + 1, ...d }));
    const repository = {
      ping: async () => true,
      listDistricts: async () => districts,
      getDistrictBySlug: async (s) => districts.find((d) => d.slug === s) ?? null,
      listCrops: async () => CROPS.map((c, i) => ({ id: i + 1, ...c })),
      getClimate: async () => ({ provenance: { runId: 1, source: 'NASA POWER', isSynthetic: false, retrievedAt: 'x', startDate: '2001-01-01', endDate: '2020-12-31', units: {} }, series }),
    };
    const app = createApp(loadConfig({}), { repository });
    const none = await request(app).post('/api/evaluate').send({ district: 'rajshahi', existingRotation: ['boro', 'aman'] });
    expect(none.status).toBe(200);
    expect(none.body.input.soil).toEqual({ salinity: null, drainage: null });
    expect(none.body.soilBasis).toEqual({ salinity: 'not_entered', drainage: 'not_entered' });
    expect(none.body.strategies[0].components.find((c) => c.id === 'soilFit').value).toBeNull();
    const given = await request(app).post('/api/evaluate').send({ district: 'rajshahi', existingRotation: ['boro', 'aman'], soil: { salinity: 'moderate', drainage: 'good' } });
    expect(given.body.soilBasis).toEqual({ salinity: 'entered', drainage: 'entered' });
    expect(given.body.strategies[0].components.find((c) => c.id === 'soilFit').value).not.toBeNull();
  });
});

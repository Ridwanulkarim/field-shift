import { describe, it, expect, vi } from 'vitest';
import { buildPowerUrl, parsePowerResponse, fetchPowerDaily, PowerError } from '../src/integrations/nasa/power.js';

// HAND-BUILT FIXTURE. It mimics the documented shape of a POWER daily response so we can test
// our parser. It contains invented numbers: it is NOT NASA data, and passing these tests does
// NOT prove that the live service behaves this way. The live check is `npm run ingest:nasa`.
function fixtureResponse(overrides = {}) {
  return {
    type: 'Feature',
    properties: {
      parameter: {
        PRECTOTCORR: { 20240101: 0, 20240102: 12.5, 20240103: -999, 20240104: 1500 },
        T2M_MAX: { 20240101: 24.1, 20240102: 25, 20240103: 26.2, 20240104: 27 },
        T2M_MIN: { 20240101: 12, 20240102: 13, 20240103: 14, 20240104: 45 },
      },
    },
    header: { title: 'FIXTURE title', fill_value: -999, sources: ['FIXTURE'], api: { version: 'vX' }, time_standard: 'LST' },
    parameters: {
      PRECTOTCORR: { units: 'mm/day' },
      T2M_MAX: { units: 'C' },
      T2M_MIN: { units: 'C' },
    },
    ...overrides,
  };
}

describe('buildPowerUrl', () => {
  it('asks for the three parameters in the AG community as JSON', () => {
    const url = new URL(buildPowerUrl({ latitude: 24.37, longitude: 88.6, startDate: '20010101', endDate: '20251231' }));
    expect(url.origin + url.pathname).toBe('https://power.larc.nasa.gov/api/temporal/daily/point');
    expect(url.searchParams.get('parameters')).toBe('PRECTOTCORR,T2M_MAX,T2M_MIN');
    expect(url.searchParams.get('community')).toBe('AG');
    expect(url.searchParams.get('latitude')).toBe('24.37');
    expect(url.searchParams.get('longitude')).toBe('88.6');
    expect(url.searchParams.get('start')).toBe('20010101');
    expect(url.searchParams.get('end')).toBe('20251231');
    expect(url.searchParams.get('format')).toBe('JSON');
  });
});

describe('parsePowerResponse', () => {
  const parsed = parsePowerResponse(fixtureResponse(), { startDate: '20240101', endDate: '20240104' });

  it('turns the fill value into null instead of a number', () => {
    expect(parsed.days[2].precipMm).toBeNull();
    expect(parsed.fillValue).toBe(-999);
  });
  it('keeps valid values and formats dates as ISO', () => {
    expect(parsed.days[1]).toEqual({ date: '2024-01-02', precipMm: 12.5, tMaxC: 25, tMinC: 13 });
  });
  it('treats physically implausible values as missing and says so', () => {
    expect(parsed.days[3].precipMm).toBeNull(); // 1500 mm/day
    expect(parsed.days[3].tMinC).toBeNull(); // 45 C daily minimum is outside the limit used
    expect(parsed.warnings.join(' ')).toMatch(/outside plausible limits/);
  });
  it('counts missing values per variable', () => {
    expect(parsed.missing).toEqual({ precipMm: 2, tMaxC: 0, tMinC: 1 });
  });
  it('records units and product metadata reported by NASA', () => {
    expect(parsed.units).toEqual({ PRECTOTCORR: 'mm/day', T2M_MAX: 'C', T2M_MIN: 'C' });
    expect(parsed.product).toBe('FIXTURE title');
  });
  it('warns when fewer days arrive than requested', () => {
    const p = parsePowerResponse(fixtureResponse(), { startDate: '20240101', endDate: '20240110' });
    expect(p.warnings.join(' ')).toMatch(/Received 4 days but 10 were requested/);
  });
  it('refuses a response with a missing parameter', () => {
    const bad = fixtureResponse();
    delete bad.properties.parameter.T2M_MAX;
    expect(() => parsePowerResponse(bad)).toThrow(PowerError);
  });
  it('refuses unexpected units rather than guessing', () => {
    const bad = fixtureResponse({ parameters: { PRECTOTCORR: { units: 'inches' }, T2M_MAX: { units: 'C' }, T2M_MIN: { units: 'C' } } });
    expect(() => parsePowerResponse(bad)).toThrow(/Unexpected units/);
  });
  it('refuses an unrecognisable body', () => {
    expect(() => parsePowerResponse({})).toThrow(/properties.parameter/);
    expect(() => parsePowerResponse(null)).toThrow(PowerError);
  });
  it('notes when units are not reported but still parses', () => {
    const p = parsePowerResponse(fixtureResponse({ parameters: undefined }));
    expect(p.warnings.join(' ')).toMatch(/Units for PRECTOTCORR not reported/);
  });
});

describe('fetchPowerDaily', () => {
  const args = { latitude: 24.37, longitude: 88.6, startDate: '20240101', endDate: '20240104' };
  const ok = () => ({ ok: true, status: 200, json: async () => fixtureResponse() });
  const status = (code) => ({ ok: false, status: code, text: async () => 'error body' });
  const sleep = vi.fn(async () => {});

  it('returns the parsed data on success', async () => {
    const fetchImpl = vi.fn(async () => ok());
    const r = await fetchPowerDaily(args, { fetchImpl, sleep });
    expect(r.parsed.days).toHaveLength(4);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('retries on a 503 and then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok());
    const r = await fetchPowerDaily(args, { fetchImpl, sleep });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.parsed.days).toHaveLength(4);
  });
  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn(async () => status(404));
    await expect(fetchPowerDaily(args, { fetchImpl, sleep })).rejects.toThrow(/HTTP 404/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('gives up after the retries are used and reports the last error', async () => {
    const fetchImpl = vi.fn(async () => status(500));
    await expect(fetchPowerDaily(args, { fetchImpl, sleep, retries: 2 })).rejects.toThrow(/HTTP 500/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('retries network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('socket hang up')).mockResolvedValueOnce(ok());
    const r = await fetchPowerDaily(args, { fetchImpl, sleep });
    expect(r.parsed.days).toHaveLength(4);
  });
});

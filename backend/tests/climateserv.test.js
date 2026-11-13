import { describe, it, expect } from 'vitest';
import {
  polygonFromBounds, buildSubmitUrl, parseJobId, parseProgress, parseRowDate, parseDailyRainfall, yearChunks,
  fetchRainfallChunk, fetchDailyRainfall, ClimateServError, MAX_DAYS_PER_REQUEST,
} from '../src/integrations/climateserv/climateserv.js';
import { FIXTURE_JOB_ID, fixtureDataResponse, datesBetween } from './helpers/climateservSample.js';
import { powerCellFor } from '../src/geo/climateGrid.js';

const polygon = polygonFromBounds(powerCellFor(24.37, 88.6).bounds);
const ok = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => JSON.stringify(json) });
const noSleep = async () => {};

// A fake ClimateSERV that answers the three calls. FIXTURE data only.
function fakeService({ progressSteps = [40, 100], dataFor = (a, b) => fixtureDataResponse(datesBetween(a, b)) } = {}) {
  const calls = [];
  let polls = 0;
  const impl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith('/submitDataRequest/')) { polls = 0; return ok([FIXTURE_JOB_ID]); }
    if (u.pathname.endsWith('/getDataRequestProgress/')) return ok([progressSteps[Math.min(polls++, progressSteps.length - 1)]]);
    if (u.pathname.endsWith('/getDataFromRequest/')) {
      const q = calls.find((c) => c.includes('submitDataRequest')) && [...calls].reverse().find((c) => c.includes('submitDataRequest'));
      const sp = new URL(q).searchParams;
      const iso = (s) => `${s.slice(6, 10)}-${s.slice(0, 2)}-${s.slice(3, 5)}`;
      return ok(dataFor(iso(sp.get('begintime')), iso(sp.get('endtime'))));
    }
    return { ok: false, status: 404, text: async () => 'nope', json: async () => ({}) };
  };
  return { impl, calls };
}

describe('request building', () => {
  it('turns bounds into a closed GeoJSON polygon', () => {
    const p = polygonFromBounds({ minLon: 88, maxLon: 89, minLat: 24, maxLat: 25 });
    expect(p.coordinates[0]).toHaveLength(5);
    expect(p.coordinates[0][0]).toEqual(p.coordinates[0][4]);
    expect(p.coordinates[0][0]).toEqual([88, 24]); // [lon, lat]
  });
  it('rejects bad bounds', () => {
    expect(() => polygonFromBounds({ minLon: 89, maxLon: 88, minLat: 24, maxLat: 25 })).toThrow(/min < max/);
    expect(() => polygonFromBounds({ minLon: 88, maxLon: 89, minLat: 24, maxLat: NaN })).toThrow(/finite/);
    expect(() => polygonFromBounds({ minLon: 88, maxLon: 189, minLat: 24, maxLat: 25 })).toThrow(/outside/);
  });
  it('builds the documented submit URL with MM/DD/YYYY dates', () => {
    const url = new URL(buildSubmitUrl({ startDate: '2001-06-01', endDate: '2001-06-30', polygon }));
    expect(url.pathname).toBe('/chirps/submitDataRequest/');
    expect(url.searchParams.get('datatype')).toBe('0');
    expect(url.searchParams.get('begintime')).toBe('06/01/2001');
    expect(url.searchParams.get('endtime')).toBe('06/30/2001');
    expect(url.searchParams.get('operationtype')).toBe('5');
    expect(JSON.parse(url.searchParams.get('geometry')).type).toBe('Polygon');
  });
  it('rejects reversed, impossible and oversized ranges', () => {
    expect(() => buildSubmitUrl({ startDate: '2001-07-01', endDate: '2001-06-30', polygon })).toThrow(/after/);
    expect(() => buildSubmitUrl({ startDate: '2001-02-30', endDate: '2001-03-01', polygon })).toThrow(/real dates/);
    expect(() => buildSubmitUrl({ startDate: '2001-01-01', endDate: '2002-12-31', polygon })).toThrow(new RegExp(String(MAX_DAYS_PER_REQUEST)));
  });
  it('splits a range into calendar-year chunks', () => {
    expect(yearChunks('2001-01-01', '2003-06-30')).toEqual([
      { year: 2001, startDate: '2001-01-01', endDate: '2001-12-31' },
      { year: 2002, startDate: '2002-01-01', endDate: '2002-12-31' },
      { year: 2003, startDate: '2003-01-01', endDate: '2003-06-30' },
    ]);
  });
});

describe('response parsing is strict', () => {
  it('reads a job id and refuses anything else', () => {
    expect(parseJobId([FIXTURE_JOB_ID])).toBe(FIXTURE_JOB_ID);
    expect(parseJobId(FIXTURE_JOB_ID)).toBe(FIXTURE_JOB_ID);
    expect(() => parseJobId({ error: 'x' })).toThrow(/job id/);
    expect(() => parseJobId([])).toThrow(/job id/);
  });
  it('reads progress, treats -1 as failure and refuses nonsense', () => {
    expect(parseProgress([42.5])).toBe(42.5);
    expect(parseProgress('100')).toBe(100);
    expect(() => parseProgress([-1])).toThrow(/failed/);
    expect(() => parseProgress([150])).toThrow(/outside/);
    expect(() => parseProgress(['abc'])).toThrow(/not a number/);
  });
  it('reads dates in US, ISO and epoch form, and refuses a row with none', () => {
    expect(parseRowDate({ date: '06/05/2001' })).toBe('2001-06-05');
    expect(parseRowDate({ date: '2001-06-05' })).toBe('2001-06-05');
    expect(parseRowDate({ epochTime: Date.parse('2001-06-05T00:00:00Z') / 1000 })).toBe('2001-06-05');
    expect(parseRowDate({ epochTime: Date.parse('2001-06-05T00:00:00Z') })).toBe('2001-06-05');
    expect(() => parseRowDate({ date: 'yesterday' })).toThrow(/readable date/);
  });
  it('returns one row per requested day, with fill and implausible values as null (never zero)', () => {
    const dates = datesBetween('2001-06-01', '2001-06-05');
    const rows = parseDailyRainfall(fixtureDataResponse(dates, (_, i) => [0, 12.5, -9999, 2000, 3][i]), { startDate: '2001-06-01', endDate: '2001-06-05' });
    expect(rows.map((r) => r.precipMm)).toEqual([0, 12.5, null, null, 3]);
  });
  it('refuses a response with a missing day, a duplicate, an extra day or a non-numeric value', () => {
    const range = { startDate: '2001-06-01', endDate: '2001-06-05' };
    const dates = datesBetween(range.startDate, range.endDate);
    expect(() => parseDailyRainfall(fixtureDataResponse(dates.filter((d) => d !== '2001-06-03')), range)).toThrow(/no row for 2001-06-03/);
    expect(() => parseDailyRainfall(fixtureDataResponse([...dates, '2001-06-01']), range)).toThrow(/more than once/);
    expect(() => parseDailyRainfall(fixtureDataResponse([...dates, '2001-06-06']), range)).toThrow(/outside/);
    expect(() => parseDailyRainfall(fixtureDataResponse(dates, () => 'wet'), range)).toThrow(/expected a number/);
    expect(() => parseDailyRainfall({ data: [] }, range)).toThrow(/no "data"/);
    expect(() => parseDailyRainfall({}, range)).toThrow(/no "data"/);
  });
});

describe('fetching (against a fake service with FIXTURE data)', () => {
  it('submits, polls until 100 and returns the daily rows', async () => {
    const svc = fakeService({ progressSteps: [10, 60, 100] });
    const { rows, jobId } = await fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-10', polygon, fetchImpl: svc.impl, sleep: noSleep });
    expect(jobId).toBe(FIXTURE_JOB_ID);
    expect(rows).toHaveLength(10);
    expect(svc.calls.filter((c) => c.includes('getDataRequestProgress'))).toHaveLength(3);
  });
  it('stops when the service reports a failed job', async () => {
    const svc = fakeService({ progressSteps: [-1] });
    await expect(fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-10', polygon, fetchImpl: svc.impl, sleep: noSleep })).rejects.toThrow(/failed/);
  });
  it('gives up when a job never finishes', async () => {
    const svc = fakeService({ progressSteps: [10] });
    await expect(fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-10', polygon, fetchImpl: svc.impl, sleep: noSleep, maxPolls: 3 })).rejects.toThrow(/did not finish/);
  });
  it('retries a temporary server error, then succeeds', async () => {
    let first = true;
    const svc = fakeService();
    const flaky = async (url) => (first && url.includes('submitDataRequest') ? ((first = false), { ok: false, status: 503, text: async () => '', json: async () => ({}) }) : svc.impl(url));
    const { rows } = await fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-03', polygon, fetchImpl: flaky, sleep: noSleep });
    expect(rows).toHaveLength(3);
  });
  it('does not retry a refused request and says what happened', async () => {
    const refuse = async () => ({ ok: false, status: 400, text: async () => 'bad geometry', json: async () => ({}) });
    await expect(fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-03', polygon, fetchImpl: refuse, sleep: noSleep })).rejects.toThrow(/HTTP 400: bad geometry/);
  });
  it('reports a network failure as a ClimateServError', async () => {
    const down = async () => { throw new TypeError('fetch failed'); };
    await expect(fetchRainfallChunk({ startDate: '2001-06-01', endDate: '2001-06-03', polygon, fetchImpl: down, sleep: noSleep })).rejects.toBeInstanceOf(ClimateServError);
  });
  it('fetches several years, one request per year, in order', async () => {
    const svc = fakeService({ progressSteps: [100] });
    const seen = [];
    const { rows, jobs } = await fetchDailyRainfall({ startDate: '2001-12-30', endDate: '2002-01-02', polygon, fetchImpl: svc.impl, sleep: noSleep, onProgress: (p) => seen.push(p.year) });
    expect(rows.map((r) => r.date)).toEqual(['2001-12-30', '2001-12-31', '2002-01-01', '2002-01-02']);
    expect(jobs).toHaveLength(2);
    expect(seen).toEqual([2001, 2002]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildGranuleSearchUrl, parseGranuleTitle, parseGranuleSearch, listImergGranules, getImergCoverage, buildSubsetUrl, parseSubsetCsv,
  pixelDaysFromSubset, fetchImergDay, ImergError, IMERG_COLLECTION,
} from '../src/integrations/nasa/imerg.js';
import { imergPixelsInCell } from '../src/geo/imergGrid.js';
import { powerCellFor } from '../src/geo/climateGrid.js';
import { REAL_SUBSET_CSV, REAL_GRANULE_ENTRY, ASSUMED_TWO_VARIABLE_CSV } from './helpers/imergSample.js';

const pixels = imergPixelsInCell(powerCellFor(24.37, 88.6)); // 5 rows (lat) x 7 columns (lon)
const granule = { date: '2020-07-01', opendapUrl: REAL_GRANULE_ENTRY.links[2].href };
const TOKEN = 'SECRET-TOKEN-VALUE';
const res = (status, body = '') => ({ ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) });

describe('granule search', () => {
  it('builds a CMR URL for the product and range', () => {
    const url = buildGranuleSearchUrl({ startDate: '2020-07-01', endDate: '2020-07-31' });
    expect(url).toContain('short_name=GPM_3IMERGDF');
    expect(url).toContain('version=07');
    expect(url).toContain('temporal=2020-07-01T00:00:00Z,2020-07-31T23:59:59Z');
  });
  it('rejects bad or reversed dates', () => {
    expect(() => buildGranuleSearchUrl({ startDate: '2020-13-01', endDate: '2020-07-31' })).toThrow(/YYYY-MM-DD/);
    expect(() => buildGranuleSearchUrl({ startDate: '2020-08-01', endDate: '2020-07-31' })).toThrow(/after/);
  });
  it('reads the real CMR entry: date from the title, OPeNDAP link from the links', () => {
    const { granules, skipped } = parseGranuleSearch({ feed: { entry: [REAL_GRANULE_ENTRY, { title: 'odd', links: [] }] } });
    expect(granules).toEqual([{ date: '2020-07-01', fileVersion: 'V07B', title: REAL_GRANULE_ENTRY.title, opendapUrl: REAL_GRANULE_ENTRY.links[2].href }]);
    expect(skipped).toBe(1);
  });
  it('refuses a response that is not a CMR feed', () => {
    expect(() => parseGranuleSearch({})).toThrow(/feed\.entry/);
  });
  it('pages until a short page and returns granules sorted by date, once each', async () => {
    const entry = (d) => ({ title: `GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.${d}-S000000-E235959.V07B.nc4`, links: [{ href: `https://opendap.earthdata.nasa.gov/x/${d}` }] });
    const pages = { 1: [entry('20200702'), entry('20200701')], 2: [entry('20200703')] };
    const fetchImpl = async (url) => {
      const page = Number(/page_num=(\d+)/.exec(url)[1]);
      return res(200, JSON.stringify({ feed: { entry: pages[page] ?? [] } }));
    };
    const { granules } = await listImergGranules({ startDate: '2020-07-01', endDate: '2020-07-03' }, { fetchImpl, pageSize: 2 });
    expect(granules.map((g) => g.date)).toEqual(['2020-07-01', '2020-07-02', '2020-07-03']);
  });
  it('reports a CMR error status', async () => {
    await expect(listImergGranules({ startDate: '2020-07-01', endDate: '2020-07-03' }, { fetchImpl: async () => res(500) })).rejects.toThrow(/HTTP 500/);
  });
});

describe('version provenance', () => {
  it('separates the collection version (07) from the file version (V07B)', () => {
    expect(IMERG_COLLECTION.collectionVersion).toBe('07');
    expect(IMERG_COLLECTION.versionNote).toMatch(/V07A\/V07B/);
    expect(parseGranuleTitle(REAL_GRANULE_ENTRY.title)).toEqual({ date: '2020-07-01', fileVersion: 'V07B' });
    expect(parseGranuleTitle('GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.19980101-S000000-E235959.V07A.nc4')).toEqual({ date: '1998-01-01', fileVersion: 'V07A' });
    expect(parseGranuleTitle('something else')).toBeNull();
  });
});

describe('coverage comes from CMR, not from a fixed date', () => {
  const entry = (d, v) => ({ title: `GPM_3IMERGDF.07:3B-DAY.MS.MRG.3IMERG.${d}-S000000-E235959.${v}.nc4`, links: [{ href: `https://opendap.earthdata.nasa.gov/x/${d}` }] });
  it('reads the first and last available day and their file versions', async () => {
    const fetchImpl = async (url) => res(200, JSON.stringify({ feed: { entry: [url.includes('sort_key=-start_date') ? entry('20250930', 'V07B') : entry('19980101', 'V07A')] } }));
    expect(await getImergCoverage({ fetchImpl, today: '2026-11-07' })).toEqual({ firstDate: '1998-01-01', firstFileVersion: 'V07A', lastDate: '2025-09-30', lastFileVersion: 'V07B' });
  });
  it('queries from 1990 so that no start date is assumed', async () => {
    const urls = [];
    const fetchImpl = async (url) => { urls.push(url); return res(200, JSON.stringify({ feed: { entry: [entry('20000601', 'V07B')] } })); };
    await getImergCoverage({ fetchImpl, today: '2026-11-07' });
    expect(urls.every((u) => u.includes('temporal=1990-01-01T00:00:00Z'))).toBe(true);
    expect(urls.some((u) => u.includes('sort_key=-start_date'))).toBe(true);
  });
  it('fails clearly when CMR has no granules', async () => {
    await expect(getImergCoverage({ fetchImpl: async () => res(200, JSON.stringify({ feed: { entry: [] } })) })).rejects.toThrow(/no granules/);
  });
});

describe('subset URL', () => {
  it('asks for both variables and percent-encodes the DAP4 constraint (raw brackets are rejected by the server)', () => {
    const url = buildSubsetUrl(granule.opendapUrl, pixels);
    expect(url).toContain('.nc4.dap.csv?dap4.ce=');
    const ce = decodeURIComponent(url.split('dap4.ce=')[1]);
    expect(ce).toBe('/precipitation[0][2684:2690][1142:1146];/precipitation_cnt[0][2684:2690][1142:1146]');
    expect(url).not.toMatch(/[[\]]/);
  });
  it('refuses to send anything to another host', () => {
    expect(() => buildSubsetUrl('https://evil.example/x.nc4', pixels)).toThrow(/other than opendap\.earthdata\.nasa\.gov/);
  });
});

describe('parseSubsetCsv', () => {
  it('reads the REAL precipitation response: 7 longitude rows x 5 latitude values', () => {
    const v = parseSubsetCsv(REAL_SUBSET_CSV, pixels, ['precipitation']);
    expect(v.precipitation).toHaveLength(7);
    expect(v.precipitation.every((row) => row.length === 5)).toBe(true);
    expect(v.precipitation[0]).toEqual([0, 0, 0.165, 1.305, 1.97]);
    expect(v.precipitation[6]).toEqual([0.025, 0, 0, 2.96, 3.49]);
  });
  it('reads both variables from the ASSUMED two-variable layout', () => {
    const v = parseSubsetCsv(ASSUMED_TWO_VARIABLE_CSV, pixels);
    expect(v.precipitation[6]).toEqual([0.025, 0, 0, 2.96, 3.49]);
    expect(v.precipitation_cnt[6]).toEqual([48, 48, 48, 48, 12]);
  });
  it('refuses a response that lacks a requested variable (quality count is never silently dropped)', () => {
    expect(() => parseSubsetCsv(REAL_SUBSET_CSV, pixels)).toThrow(/0 longitude rows for precipitation_cnt/);
  });
  it('refuses a response of the wrong shape', () => {
    const one = ['precipitation'];
    expect(() => parseSubsetCsv(REAL_SUBSET_CSV, { ...pixels, rows: { ...pixels.rows, count: 4 } }, one)).toThrow(/expected 4/);
    expect(() => parseSubsetCsv(REAL_SUBSET_CSV, { ...pixels, cols: { ...pixels.cols, count: 8 } }, one)).toThrow(/expected 8/);
    expect(() => parseSubsetCsv('Dataset: x\n', pixels, one)).toThrow(/0 longitude rows/);
    expect(() => parseSubsetCsv(REAL_SUBSET_CSV.replace('[0][3]', '[0][9]'), pixels, one)).toThrow(/longitude order/);
    expect(() => parseSubsetCsv(REAL_SUBSET_CSV.replace('[0][0]', '[1][0]'), pixels, one)).toThrow(/time index/);
  });
});

describe('pixelDaysFromSubset (native pixels, nothing averaged)', () => {
  const parsed = parseSubsetCsv(ASSUMED_TWO_VARIABLE_CSV, pixels);
  it('returns one record per pixel with its row, column, value, count and file version', () => {
    const days = pixelDaysFromSubset(parsed, pixels, { fileVersion: 'V07B' });
    expect(days).toHaveLength(35);
    // longitude offset 0, latitude offset 2 -> column 2684, row 1144
    expect(days.find((d) => d.col === 2684 && d.row === 1144)).toEqual({ row: 1144, col: 2684, precipMm: 0.165, precipitationCnt: 48, fileVersion: 'V07B' });
    expect(days.find((d) => d.col === 2690 && d.row === 1146)).toMatchObject({ precipMm: 3.49, precipitationCnt: 12 });
  });
  it('keeps zero rain as 0, not missing', () => {
    const days = pixelDaysFromSubset(parsed, pixels);
    expect(days.find((d) => d.col === 2684 && d.row === 1142).precipMm).toBe(0);
  });
  it('stores a fill value, NaN, negative or absurd value as missing (null), never zero', () => {
    const one = { rows: { first: 5, last: 5, count: 1 }, cols: { first: 7, last: 10, count: 4 } };
    const days = pixelDaysFromSubset({ precipitation: [[-9999.9], [NaN], [-1], [5000]], precipitation_cnt: [[48], [48], [48], [48]] }, one);
    expect(days.map((d) => d.precipMm)).toEqual([null, null, null, null]);
  });
  it('stores an impossible or missing count as null but keeps the precipitation value', () => {
    const one = { rows: { first: 5, last: 5, count: 1 }, cols: { first: 7, last: 10, count: 4 } };
    const days = pixelDaysFromSubset({ precipitation: [[1], [1], [1], [1]], precipitation_cnt: [[49], [-1], [2.5], [0]] }, one);
    expect(days.map((d) => d.precipMm)).toEqual([1, 1, 1, 1]);
    expect(days.map((d) => d.precipitationCnt)).toEqual([null, null, null, 0]);
  });
});

describe('fetchImergDay', () => {
  const noSleep = async () => {};
  const g = { ...granule, fileVersion: 'V07B' };
  it('sends the token only as a Bearer header and returns native pixels with the file version', async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => { calls.push({ url, opts }); return res(200, ASSUMED_TWO_VARIABLE_CSV); };
    const out = await fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl, sleep: noSleep });
    expect(out.pixels).toHaveLength(35);
    expect(out.pixels.every((p) => p.fileVersion === 'V07B')).toBe(true);
    expect(calls[0].opts.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].url).not.toContain(TOKEN);
  });
  it('treats 401 and 403 as fatal and never echoes the token', async () => {
    for (const status of [401, 403]) {
      const err = await fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl: async () => res(status), sleep: noSleep }).catch((e) => e);
      expect(err).toBeInstanceOf(ImergError);
      expect(err.fatal).toBe(true);
      expect(err.message).not.toContain(TOKEN);
    }
  });
  it('is fatal without a token', async () => {
    const err = await fetchImergDay({ granule: g, block: pixels, token: '' }, { fetchImpl: async () => res(200), sleep: noSleep }).catch((e) => e);
    expect(err.fatal).toBe(true);
  });
  it('retries 503 and network errors, then succeeds', async () => {
    let n = 0;
    const fetchImpl = async () => { n += 1; if (n === 1) return res(503); if (n === 2) throw new Error('socket hang up'); return res(200, ASSUMED_TWO_VARIABLE_CSV); };
    const out = await fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl, sleep: noSleep });
    expect(out.pixels).toHaveLength(35);
    expect(n).toBe(3);
  });
  it('gives up after the retries and does not retry a 404', async () => {
    let n = 0;
    await expect(fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl: async () => { n += 1; return res(503); }, retries: 2, sleep: noSleep })).rejects.toThrow(/HTTP 503/);
    expect(n).toBe(3);
    n = 0;
    await expect(fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl: async () => { n += 1; return res(404); }, sleep: noSleep })).rejects.toThrow(/HTTP 404/);
    expect(n).toBe(1);
  });
  it('refuses a body that does not have the requested shape', async () => {
    await expect(fetchImergDay({ granule: g, block: pixels, token: TOKEN }, { fetchImpl: async () => res(200, 'Dataset: x\n'), sleep: noSleep })).rejects.toThrow(/longitude rows/);
  });
});

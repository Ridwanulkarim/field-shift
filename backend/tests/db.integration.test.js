// Integration test against a REAL PostgreSQL database (local or a Neon dev branch).
// It is skipped unless TEST_DATABASE_URL is set, because it needs a migrated database:
//   TEST_DATABASE_URL=postgresql://... npm test
// It creates one throw-away district and deletes it afterwards.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { ingestDistrict } from '../src/integrations/nasa/ingest.js';
import { storeRun } from '../src/data/climateStore.js';
import { generateSyntheticSeries } from '../src/integrations/fixture/synthetic.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { CROPS } from '../src/data/reference/crops.js';
import request from 'supertest';

const url = process.env.TEST_DATABASE_URL;
const SLUG = 'zz-test-district';

describe.skipIf(!url)('database integration', () => {
  let prisma;
  let repo;
  let district;

  beforeAll(async () => {
    prisma = createPrismaClient(url);
    repo = createRepository(prisma);
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    district = await prisma.district.create({
      data: { slug: SLUG, nameEn: 'Test', nameBn: 'টেস্ট', division: 'Test', latitude: 24.37, longitude: 88.6, coordNote: 'test' },
    });
    for (const c of CROPS) await prisma.crop.upsert({ where: { slug: c.slug }, create: c, update: c });
  });

  afterAll(async () => {
    await prisma.district.deleteMany({ where: { slug: SLUG } });
    await prisma.$disconnect();
  });

  it('answers the database health check', async () => {
    expect(await repo.ping()).toBe(true);
  });

  it('stores a synthetic run and reads it back with provenance', async () => {
    const days = generateSyntheticSeries({ startYear: 2001, endYear: 2005, seed: 7 });
    await storeRun(prisma, {
      districtId: district.id,
      days,
      run: { source: 'SYNTHETIC', isSynthetic: true, endpointUrl: 'synthetic://test', requestParams: { seed: 7 }, startDate: '2001-01-01', endDate: '2005-12-31' },
    });
    const climate = await repo.getClimate(district.id);
    expect(climate.provenance.isSynthetic).toBe(true);
    expect(climate.series).toHaveLength(days.length);
    expect(climate.series[0].date).toBe('2001-01-01');
  });

  it('prefers real data over synthetic and keeps null for missing values', async () => {
    const fetchPower = async () => ({
      url: 'https://example.invalid/power',
      parsed: {
        days: [
          { date: '2001-01-01', precipMm: null, tMaxC: 25, tMinC: 12 },
          { date: '2001-01-02', precipMm: 3.2, tMaxC: 26, tMinC: 13 },
        ],
        fillValue: -999,
        units: { PRECTOTCORR: 'mm/day', T2M_MAX: 'C', T2M_MIN: 'C' },
        missing: { precipMm: 1, tMaxC: 0, tMinC: 0 },
        warnings: ['fixture'],
        product: 'TEST FIXTURE (not NASA data)',
        sources: null,
        apiVersion: null,
        timeStandard: null,
      },
    });
    // 50% missing on one variable exceeds the 20% limit, so this must be REFUSED and recorded as failed.
    const refused = await ingestDistrict({ prisma, district, startYear: 2001, endYear: 2001, fetchPower });
    expect(refused.ok).toBe(false);
    const failed = await repo.recentFailedRuns();
    expect(failed.some((f) => f.district === SLUG && /Too much missing data/.test(f.errorMessage))).toBe(true);

    const okFetch = async () => {
      const r = await fetchPower();
      r.parsed.days = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(Date.UTC(2001, 0, 1 + i)).toISOString().slice(0, 10),
        precipMm: i === 3 ? null : 1,
        tMaxC: 30,
        tMinC: 20,
      }));
      r.parsed.missing = { precipMm: 1, tMaxC: 0, tMinC: 0 };
      return r;
    };
    const accepted = await ingestDistrict({ prisma, district, startYear: 2001, endYear: 2001, fetchPower: okFetch });
    expect(accepted.ok).toBe(true);

    const climate = await repo.getClimate(district.id);
    expect(climate.provenance.isSynthetic).toBe(false);
    expect(climate.provenance.source).toBe('NASA POWER');
    expect(climate.provenance.product).toMatch(/TEST FIXTURE/);
    expect(climate.series[3].precipMm).toBeNull();
    expect(climate.provenance.missingCount).toBe(1);
  });

  it('serves a full evaluation from the database through the API', async () => {
    const app = createApp(loadConfig({}), { repository: repo });
    const res = await request(app).post('/api/evaluate').send({ district: SLUG, existingRotation: ['aman', 'mustard'] });
    expect(res.status).toBe(200);
    expect(res.body.strategies.length).toBe(4);
  });
});

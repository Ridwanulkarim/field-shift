import { describe, it, expect } from 'vitest';
import { storeRun } from '../src/data/climateStore.js';

function fakePrisma() {
  const calls = {
    createdRun: null,
    dailyRows: [],
    deleteWhere: null,
  };
  const tx = {
    datasetRun: {
      create: async ({ data }) => {
        calls.createdRun = data;
        return { id: 17 };
      },
      deleteMany: async ({ where }) => {
        calls.deleteWhere = where;
      },
    },
    climateDaily: {
      createMany: async ({ data }) => {
        calls.dailyRows.push(...data);
      },
    },
  };
  return {
    calls,
    $transaction: (callback) => callback(tx),
  };
}

describe('storeRun', () => {
  it('retains independent sources and stores dataset-specific measurements', async () => {
    const prisma = fakePrisma();

    await storeRun(prisma, {
      districtId: 4,
      run: {
        source: 'NASA GPM',
        isSynthetic: false,
        endpointUrl: 'https://example.invalid/gpm',
        requestParams: { product: 'IMERG' },
        startDate: '2025-01-01',
        endDate: '2025-01-01',
      },
      days: [
        {
          date: '2025-01-01',
          measurements: { precipMm: 12.4, accumulationPeriodHours: 24 },
        },
      ],
    });

    expect(prisma.calls.deleteWhere).toEqual({
      districtId: 4,
      source: 'NASA GPM',
      isSynthetic: false,
      id: { not: 17 },
    });
    expect(prisma.calls.dailyRows[0]).toMatchObject({
      runId: 17,
      districtId: 4,
      measurements: { precipMm: 12.4, accumulationPeriodHours: 24 },
      precipMm: undefined,
      tMaxC: undefined,
      tMinC: undefined,
    });
  });
});

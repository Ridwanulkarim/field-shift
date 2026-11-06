import { describe, it, expect } from 'vitest';
import { storeRun, runScope } from '../src/data/climateStore.js';

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
      status: 'SUCCESS',
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

describe('runScope (which older runs a new run may replace)', () => {
  it('scopes a district run to that district', () => {
    expect(runScope({ districtId: 4 })).toEqual({ districtId: 4 });
  });
  it('scopes a standalone cell run to its cell, with no district', () => {
    expect(runScope({ gridCellId: 9 })).toEqual({ districtId: null, gridCellId: 9 });
  });
  it('lets the district win if both are given', () => {
    expect(runScope({ districtId: 4, gridCellId: 9 })).toEqual({ districtId: 4 });
  });
  it('refuses a run with neither, so a delete can never match unrelated runs', () => {
    expect(() => runScope({})).toThrow(/districtId or/);
    expect(() => runScope({ districtId: null, gridCellId: null })).toThrow();
  });
  it('refuses a non-integer id', () => {
    expect(() => runScope({ districtId: '4' })).toThrow(/integer/);
    expect(() => runScope({ gridCellId: '9' })).toThrow();
  });
  it('storeRun refuses to write or delete anything when no scope is given', async () => {
    const prisma = fakePrisma();
    await expect(storeRun(prisma, { run: {}, days: [] })).rejects.toThrow(/districtId or/);
    expect(prisma.calls.deleteWhere).toBeNull();
    expect(prisma.calls.createdRun).toBeNull();
  });
});

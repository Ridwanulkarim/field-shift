// Stores one dataset run (provenance) together with its daily rows, and retires the older
// run of the same source and kind for that district so the database does not grow without limit.

const CHUNK = 3000; // 3000 rows x 8 columns stays far below PostgreSQL's 65,535-parameter limit

export async function storeRun(prisma, { districtId, run, days }) {
  return prisma.$transaction(
    async (tx) => {
      const created = await tx.datasetRun.create({
        data: {
          districtId,
          source: run.source,
          product: run.product ?? null,
          isSynthetic: run.isSynthetic,
          status: 'SUCCESS',
          endpointUrl: run.endpointUrl,
          requestParams: run.requestParams,
          startDate: new Date(`${run.startDate}T00:00:00Z`),
          endDate: new Date(`${run.endDate}T00:00:00Z`),
          fillValue: run.fillValue ?? null,
          units: run.units ?? undefined,
          rowCount: days.length,
          missingCount: run.missingCount ?? 0,
          notes: run.notes ?? null,
        },
      });
      for (let i = 0; i < days.length; i += CHUNK) {
        await tx.climateDaily.createMany({
          data: days.slice(i, i + CHUNK).map((d) => ({
            runId: created.id,
            districtId,
            date: new Date(`${d.date}T00:00:00Z`),
            precipMm: d.precipMm,
            tMaxC: d.tMaxC,
            tMinC: d.tMinC,
            measurements: d.measurements ?? undefined,
          })),
        });
      }
      await tx.datasetRun.deleteMany({
        where: {
          districtId,
          source: run.source,
          isSynthetic: run.isSynthetic,
          id: { not: created.id },
        },
      });
      return created;
    },
    { timeout: 180000, maxWait: 30000 },
  );
}

// A failed attempt is recorded too, so a failure is visible and not silent.
export async function recordFailedRun(prisma, { districtId, run, errorMessage }) {
  return prisma.datasetRun.create({
    data: {
      districtId,
      source: run.source,
      product: run.product ?? null,
      isSynthetic: run.isSynthetic,
      status: 'FAILED',
      endpointUrl: run.endpointUrl,
      requestParams: run.requestParams,
      startDate: new Date(`${run.startDate}T00:00:00Z`),
      endDate: new Date(`${run.endDate}T00:00:00Z`),
      errorMessage: String(errorMessage).slice(0, 1000),
    },
  });
}

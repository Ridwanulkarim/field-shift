// Extends each real NASA POWER run through about seven days before today.
// A failed fetch is recorded and never replaces the existing successful run.

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { fetchPowerDaily, POWER_BASE_URL, POWER_COMMUNITY, POWER_PARAMETERS } from '../src/integrations/nasa/power.js';
import { storeMergedRun, recordFailedRun } from '../src/data/climateStore.js';

const { values } = parseArgs({ options: { delay: { type: 'string' } } });
const delayMs = Number(values.delay ?? 2000);
const prisma = createPrismaClient(config.databaseUrl);
let failures = 0;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

const cutoff = new Date();
cutoff.setUTCDate(cutoff.getUTCDate() - 7);
const endDate = isoDate(cutoff);

try {
  const districts = await prisma.district.findMany({ orderBy: { slug: 'asc' } });
  for (const [i, district] of districts.entries()) {
    const previous = await prisma.datasetRun.findFirst({
      where: { districtId: district.id, source: 'NASA POWER', isSynthetic: false, status: 'SUCCESS' },
      orderBy: { retrievedAt: 'desc' },
    });
    if (!previous) {
      console.log(`${district.slug}: skipped (no stored NASA POWER run)`);
      continue;
    }
    const startDate = isoDate(previous.endDate);
    if (startDate >= endDate) {
      console.log(`${district.slug}: already current through ${startDate}`);
      continue;
    }
    const base = {
      source: 'NASA POWER',
      isSynthetic: false,
      endpointUrl: POWER_BASE_URL,
      requestParams: {
        parameters: POWER_PARAMETERS,
        community: POWER_COMMUNITY,
        latitude: district.latitude,
        longitude: district.longitude,
        start: startDate.replaceAll('-', ''),
        end: endDate.replaceAll('-', ''),
        format: 'JSON',
      },
      startDate,
      endDate,
    };
    try {
      const { parsed } = await fetchPowerDaily({
        latitude: district.latitude,
        longitude: district.longitude,
        startDate: startDate.replaceAll('-', ''),
        endDate: endDate.replaceAll('-', ''),
      });
      await storeMergedRun(prisma, {
        districtId: district.id,
        previousRunId: previous.id,
        days: parsed.days,
        run: {
          ...base,
          product: parsed.product,
          fillValue: parsed.fillValue,
          units: parsed.units,
          notes: [...parsed.warnings].join(' | '),
        },
      });
      console.log(`${district.slug}: refreshed ${startDate} through ${endDate}`);
    } catch (error) {
      failures += 1;
      await recordFailedRun(prisma, { districtId: district.id, run: base, errorMessage: error.message });
      console.log(`${district.slug}: FAILED ${error.message}`);
    }
    if (i < districts.length - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  await prisma.$disconnect();
}

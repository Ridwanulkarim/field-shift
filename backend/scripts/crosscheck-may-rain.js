// DIAGNOSTIC ONLY. Compares the stored NASA POWER May rainfall with ERA5 reanalysis rainfall
// fetched from Open-Meteo (https://open-meteo.com, free, no key). ERA5 is a model product
// from ECMWF, NOT NASA data and NOT ground truth. It is used only to see whether POWER's
// early-May jump around 2016-2022 is also present in an independent source.
// Needs internet access. Usage: node --env-file-if-exists=.env scripts/crosscheck-may-rain.js --district=rajshahi
import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { createRepository } from '../src/data/repository.js';
import { indexSeries } from '../src/science/series.js';
import { mayStats, mean, pearson } from '../src/science/crosscheck.js';

const { values } = parseArgs({ options: { district: { type: 'string' } } });
const prisma = createPrismaClient(config.databaseUrl);
const repository = createRepository(prisma);
try {
  const district = (await repository.listDistricts()).find((d) => d.slug === values.district);
  if (!district) throw new Error('Pass --district=<slug>.');
  const climate = await repository.getClimate(district.id);
  if (!climate) throw new Error('No climate data for this district.');
  const index = indexSeries(climate.series);

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.search = new URLSearchParams({
    latitude: String(district.latitude), longitude: String(district.longitude),
    start_date: '2001-05-01', end_date: '2025-05-31', daily: 'precipitation_sum', timezone: 'Asia/Dhaka',
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Open-Meteo answered HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const era = new Map();
  json.daily.time.forEach((t, i) => era.set(t, json.daily.precipitation_sum[i]));

  const years = Array.from({ length: 25 }, (_, i) => 2001 + i);
  const power = mayStats((d) => index.get(d)?.precipMm ?? null, years);
  const era5 = mayStats((d) => (era.has(d) && Number.isFinite(era.get(d)) ? era.get(d) : null), years);
  console.table(years.map((year, i) => ({
    year,
    POWER_1to7May: power[i].firstWeek === null ? null : Math.round(power[i].firstWeek),
    ERA5_1to7May: era5[i].firstWeek === null ? null : Math.round(era5[i].firstWeek),
    POWER_May: power[i].may === null ? null : Math.round(power[i].may),
    ERA5_May: era5[i].may === null ? null : Math.round(era5[i].may),
  })));
  const split = (rows, key, from, to) => mean(rows.filter((r) => r.year >= from && r.year <= to).map((r) => r[key]));
  const f = (x) => (x === null ? null : Math.round(x));
  console.table([
    { source: 'POWER', 'May mean 2001-2015': f(split(power, 'may', 2001, 2015)), 'May mean 2016-2025': f(split(power, 'may', 2016, 2025)), 'wk1 mean 2001-2015': f(split(power, 'firstWeek', 2001, 2015)), 'wk1 mean 2016-2025': f(split(power, 'firstWeek', 2016, 2025)) },
    { source: 'ERA5 (not NASA)', 'May mean 2001-2015': f(split(era5, 'may', 2001, 2015)), 'May mean 2016-2025': f(split(era5, 'may', 2016, 2025)), 'wk1 mean 2001-2015': f(split(era5, 'firstWeek', 2001, 2015)), 'wk1 mean 2016-2025': f(split(era5, 'firstWeek', 2016, 2025)) },
  ]);
  const r = (k) => pearson(power.map((p) => p[k]), era5.map((p) => p[k]));
  console.log('Correlation POWER vs ERA5 across years: May total =', r('may')?.toFixed(2), '| 1-7 May =', r('firstWeek')?.toFixed(2));
} finally {
  await prisma.$disconnect();
}

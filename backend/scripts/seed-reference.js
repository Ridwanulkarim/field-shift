// Loads districts and crops into the database (safe to run again: it updates by slug).
// Usage: npm run db:seed

import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { DISTRICTS } from '../src/data/reference/districts.js';
import { CROPS } from '../src/data/reference/crops.js';

const prisma = createPrismaClient(config.databaseUrl);
try {
  for (const d of DISTRICTS) {
    await prisma.district.upsert({ where: { slug: d.slug }, create: d, update: d });
  }
  for (const c of CROPS) {
    await prisma.crop.upsert({ where: { slug: c.slug }, create: c, update: c });
  }
  const [districts, crops] = await Promise.all([prisma.district.count(), prisma.crop.count()]);
  console.log(`Seeded reference data: ${districts} districts, ${crops} crops.`);
  console.log('Reminder: crop traits are UNVERIFIED_GENERAL_KNOWLEDGE until an agronomist reviews them.');
} finally {
  await prisma.$disconnect();
}

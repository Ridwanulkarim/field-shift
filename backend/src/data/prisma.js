// Creates the Prisma client for PostgreSQL (Neon or local). Prisma 7 talks to the database
// through a "driver adapter": here the standard `pg` driver.
//
// DATABASE_URL should be Neon's POOLED connection string for the running app.
// Only the server and the scripts import this file; unit tests use a fake repository instead.

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export function createPrismaClient(databaseUrl) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and paste your Neon connection string (see docs/SETUP.md).',
    );
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl, max: 5 });
  return new PrismaClient({ adapter });
}

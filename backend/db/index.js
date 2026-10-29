/**
 * Field Shift database adapter.
 * Prisma 7 + PostgreSQL.
 * Keeps existing SQL-based services working during migration.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

if (!config.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Configure PostgreSQL in backend/.env.'
  );
}

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL
});

const prisma = new PrismaClient({
  adapter,
  log:
    process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error']
});

async function query(text, params = []) {
  const statement = String(text).trim();

  if (
    /^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(statement) &&
    (/\bRETURNING\b/i.test(statement) ||
      /^(SELECT|WITH)\b/i.test(statement))
  ) {
    const rows = await prisma.$queryRawUnsafe(statement, ...params);
    return { rows, rowCount: rows.length };
  }

  const rowCount = await prisma.$executeRawUnsafe(statement, ...params);
  return { rows: [], rowCount };
}

async function resetDb() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'resetDb is destructive and is only allowed when NODE_ENV=test.'
    );
  }

  await query('DROP SCHEMA public CASCADE');
  await query('CREATE SCHEMA public');
}

const db = {
  prisma,
  query,
  getMode: () => 'postgres-prisma',
  getPool: () => null,
  getMemDb: () => null,
  getClient: async () => ({
    query,
    release: () => {}
  }),
  resetDb,
  disconnect: () => prisma.$disconnect()
};

export default db;

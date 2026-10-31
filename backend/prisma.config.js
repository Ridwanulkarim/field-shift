// Prisma 7 configuration. Prisma no longer reads .env by itself, so we load it here.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {
  // .env is optional when variables are supplied by the shell or CI.
}

const suffix = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // DIRECT_URL = Neon's non-pooled connection (needed by `prisma migrate`).
    // Falls back to DATABASE_URL, which is fine for a local Postgres.
    url: process.env[`DIRECT_URL_${suffix}`] || process.env[`DATABASE_URL_${suffix}`] || '',
  },
});

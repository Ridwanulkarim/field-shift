import { config } from './config/env.js';
import { createApp } from './app.js';
import { createPrismaClient } from './data/prisma.js';
import { createRepository } from './data/repository.js';

let prisma = null;
let repository;
if (config.databaseUrl) {
  prisma = createPrismaClient(config.databaseUrl);
  repository = createRepository(prisma);
} else {
  console.warn('WARNING: DATABASE_URL is not set. The API will start, but data routes will answer 503. See docs/SETUP.md.');
}

const app = createApp(config, { repository });

const server = app.listen(config.port, () => {
  console.log(`Field Shift API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  if (prisma) await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

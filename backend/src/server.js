import { config } from './config/env.js';
import { createApp } from './app.js';
import { createDataSource } from './data/dataSource.js';

// The prisma modules are imported only when a database is actually used, so OFFLINE=1 never touches them.
async function createDatabaseRepository(databaseUrl) {
  const { createPrismaClient } = await import('./data/prisma.js');
  const { createRepository } = await import('./data/repository.js');
  const prisma = createPrismaClient(databaseUrl);
  return { repository: createRepository(prisma), close: () => prisma.$disconnect() };
}

let source;
try {
  source = await createDataSource(config, { createDatabaseRepository });
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
for (const note of source.notes) (note.startsWith('WARNING') ? console.warn : console.log)(note);

if (config.sessionSecretIsEphemeral) {
  console.warn('NOTE: ANONYMOUS_SESSION_SECRET is not set, so a random secret is used for this run. Browser session cookies stop working when the server restarts. Set it in .env to keep them.');
}

const app = createApp(config, { repository: source.repository });

const server = app.listen(config.port, () => {
  console.log(`Field Shift API listening on http://localhost:${config.port} (data mode: ${source.mode})`);
});

async function shutdown() {
  server.close();
  await source.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

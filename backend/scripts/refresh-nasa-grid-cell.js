// Incrementally refresh a previously ingested NASA POWER grid cell.
// Usage: node --env-file-if-exists=.env scripts/refresh-nasa-grid-cell.js <lat> <lon>
//    or: node --env-file-if-exists=.env scripts/refresh-nasa-grid-cell.js --cell <latIndex:lonIndex>

import { createPrismaClient } from '../src/data/prisma.js';
import { refreshGridCell } from '../src/integrations/nasa/ingest.js';
import { config } from '../src/config/env.js';

const args = process.argv.slice(2);
let request;
if (args[0] === '--cell' && args.length === 2) {
  request = { cellKey: args[1] };
} else if (args.length === 2) {
  request = { latitude: Number(args[0]), longitude: Number(args[1]) };
} else {
  throw new Error('Expected <lat> <lon> or --cell <latIndex:lonIndex>.');
}

const prisma = createPrismaClient(config.databaseUrl);
try {
  const result = await refreshGridCell({ prisma, ...request });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

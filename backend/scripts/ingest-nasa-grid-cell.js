// Ingest NASA POWER daily observations for a native provider grid cell, independent of districts.
// Usage: node --env-file-if-exists=.env scripts/ingest-nasa-grid-cell.js <lat> <lon> <start> <end>
//    or: node --env-file-if-exists=.env scripts/ingest-nasa-grid-cell.js --cell <latIndex:lonIndex> <start> <end>

import { createPrismaClient } from '../src/data/prisma.js';
import { ingestGridCell } from '../src/integrations/nasa/ingest.js';
import { config } from '../src/config/env.js';

const args = process.argv.slice(2);
let request;
if (args[0] === '--cell' && args.length === 4) {
  request = { cellKey: args[1], startDate: args[2], endDate: args[3] };
} else if (args.length === 4) {
  request = { latitude: Number(args[0]), longitude: Number(args[1]), startDate: args[2], endDate: args[3] };
} else {
  throw new Error('Expected <lat> <lon> <YYYY-MM-DD> <YYYY-MM-DD> or --cell <latIndex:lonIndex> <YYYY-MM-DD> <YYYY-MM-DD>.');
}

const prisma = createPrismaClient(config.databaseUrl);
try {
  const result = await ingestGridCell({ prisma, ...request });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

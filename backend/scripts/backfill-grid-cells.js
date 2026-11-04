// Records which NASA POWER grid cell each stored real run describes (DatasetRun.gridCellId).
// Needed once, after migration 20261105000000_add_climate_grid_cells, for runs stored before cells existed.
// It never changes climate values and only touches runs whose gridCellId is still empty. Safe to repeat.
//
// Usage:
//   npm run db:backfill-cells -- --dry-run     (report only, writes nothing)
//   npm run db:backfill-cells

import { parseArgs } from 'node:util';
import { config } from '../src/config/env.js';
import { createPrismaClient } from '../src/data/prisma.js';
import { backfillGridCells } from '../src/data/climateStore.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const prisma = createPrismaClient(config.databaseUrl);
try {
  const result = await backfillGridCells(prisma, { dryRun: values['dry-run'] });
  console.log(`${values['dry-run'] ? 'DRY RUN: ' : ''}${result.runsFound} real NASA POWER run(s) without a grid cell.`);
  for (const cell of result.cells) {
    console.log(`  cell ${cell.cellKey} (centre ${cell.centerLat}, ${cell.centerLon}): ${cell.districts.join(', ')}`);
    if (cell.districts.length > 1) console.log('    -> these districts share one grid cell and therefore the same NASA values');
  }
  if (!values['dry-run']) console.log(`Updated ${result.runsUpdated} run(s).`);
} finally {
  await prisma.$disconnect();
}

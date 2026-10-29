import { runMigration } from './migrate.js';
import { seedReferenceData } from './seed_reference.js';
import { seedCropsData } from './seed_crops.js';
import { seedDemoFieldsData } from './seed_demo_fields.js';
import { seedObservations } from './seed_observations.js';
import { fileURLToPath } from 'node:url';
/**
 * Field Shift - Baselines Seed Script (Phase 6)
 * Computes and persists historical baselines across all 5 demo fields and variables.
 * Spec Section 10, 12, 13, 14, 43.
 */
import db from './index.js';
import FieldsModel from '../models/fieldsModel.js';
import FieldCropHistoryModel from '../models/fieldCropHistoryModel.js';
import BaselinesModel from '../models/baselinesModel.js';
import baselineEngine from '../services/nasa/baselineEngine.js';
import config from '../config/index.js';

async function seedBaselines() {
  console.log('[Seed Baselines] Computing and Seeding Historical Baselines for Demo Fields...');
  console.log(`[Seed Baselines] Anchor Date: ${config.DEMO_ANCHOR_DATE} (DOY 59 +/- 7 days)`);

  const fields = await FieldsModel.findAll();
  let totalCreated = 0;
  const allBaselines = [];

  for (const field of fields) {
    const history = await FieldCropHistoryModel.findByField(field.id);
    const baselines = baselineEngine.computeFieldBaselines(field, history, config.DEMO_ANCHOR_DATE);

    for (const b of baselines) {
      const created = await BaselinesModel.create(b);
      allBaselines.push(created);
      totalCreated++;
    }

    console.log(`  - Field ${field.id} (${field.name}): Seeded ${baselines.length} variable baselines.`);
  }

  console.log(`[Seed Baselines] Successfully seeded ${totalCreated} baseline records into 'baselines' table.\n`);
  return allBaselines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {

  (async () => {
    await db.resetDb();
    await runMigration();
    await seedReferenceData();
    await seedCropsData();
    await seedDemoFieldsData();
    await seedObservations();
    const baselines = await seedBaselines();

    console.log('========================================================================================');
    console.log('                        FIELD SHIFT - HISTORICAL BASELINES TABLE');
    console.log('========================================================================================');
    console.table(
      baselines.map(b => ({
        'Field ID': b.field_id,
        Variable: b.variable,
        Season: b.season,
        Mean: Number(b.mean).toFixed(4),
        Std: Number(b.std).toFixed(4),
        n: b.n,
        'n_years': b.n_years,
        'Years Included': b.years_included,
        'Sample Quality': b.sample_quality,
        'Crop Matched': b.crop_matched === null ? 'NULL' : String(b.crop_matched)
      }))
    );
    process.exit(0);
  })().catch(err => {
    console.error('[Seed Baselines] Failed:', err);
    process.exit(1);
  });
}

export { seedBaselines };

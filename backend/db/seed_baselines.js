/**
 * Field Shift - Baselines Seed Script (Phase 6)
 * Computes and persists historical baselines across all 5 demo fields and variables.
 * Spec Section 10, 12, 13, 14, 43.
 */
const db = require('./index');
const FieldsModel = require('../models/fieldsModel');
const FieldCropHistoryModel = require('../models/fieldCropHistoryModel');
const BaselinesModel = require('../models/baselinesModel');
const baselineEngine = require('../services/nasa/baselineEngine');
const config = require('../config');

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

if (require.main === module) {
  const { runMigration } = require('./migrate');
  const { seedReferenceData } = require('./seed_reference');
  const { seedCropsData } = require('./seed_crops');
  const { seedDemoFieldsData } = require('./seed_demo_fields');
  const { seedObservations } = require('./seed_observations');

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

module.exports = { seedBaselines };

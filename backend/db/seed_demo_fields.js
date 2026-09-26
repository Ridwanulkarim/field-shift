/**
 * Field Shift - Demo Fields & Crop History Seed Script (Phase 3 - Corrected)
 * Spec Section 51 (Demo Data), Section 43 (Fields & Field Crop History), Section 11 (Rabi Year Rule)
 *
 * Requirements & Conventions:
 * - DEMO_ANCHOR_DATE = '2024-02-28' falls at the end of the Rabi 2023 season window (Nov 1, 2023 - Feb 28, 2024).
 * - current_season = 'Rabi'.
 * - current_crop = the standing crop growing in the field during Rabi 2023 (e.g. Chickpea, Wheat, Boro Rice, Mustard, Lentil).
 * - previous_crop = the prior completed season's crop (Kharif-2 2023, July-Oct 2023), which is 'T. Aman Rice' (Cereal).
 * - field_crop_history stores historical seasons with the Rabi start-year rule (Nov 2023-Feb 2024 is year 2023).
 * - is_demo = true.
 * - data_label = 'Pre-processed NASA observations' (Fields 1-4) or 'Simulated demonstration data' (Field 5).
 * - All history labeled source = 'hand-entered demo data'.
 */

const db = require('./index');
const FieldsModel = require('../models/fieldsModel');
const FieldCropHistoryModel = require('../models/fieldCropHistoryModel');

const DEMO_FIELDS = [
  {
    name: 'Godagari Barind Terrace (Rajshahi)',
    latitude: 24.4715,
    longitude: 88.3325,
    area_hectares: 1.20,
    soil_type: 'Silty Clay Loam (Barind Red Clay)',
    soil_ph: 5.80,
    organic_matter_percent: 1.10,
    drainage: 'moderate',
    irrigation_available: false, // Rainfed drought-prone Barind tract
    current_season: 'Rabi',
    current_crop: 'Chickpea', // Rabi winter drought-tolerant pulse
    current_crop_family: 'Legume',
    previous_crop: 'T. Aman Rice', // Prior season Kharif-2 2023
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Pre-processed NASA observations',
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[
        [88.3315, 24.4705],
        [88.3335, 24.4705],
        [88.3335, 24.4725],
        [88.3315, 24.4725],
        [88.3315, 24.4705]
      ]]
    },
    history: [
      // 2019
      { year: 2019, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume' },
      // 2020
      { year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2021
      { year: 2021, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume' },
      // 2022
      { year: 2022, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2023 (Current cycle leading to 2024-02-28 anchor date)
      { year: 2023, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume' }
    ]
  },
  {
    name: 'Birol Piedmont Alluvial Plain (Dinajpur)',
    latitude: 25.6280,
    longitude: 88.5820,
    area_hectares: 1.80,
    soil_type: 'Sandy Loam (Old Himalayan Piedmont)',
    soil_ph: 5.40,
    organic_matter_percent: 1.35,
    drainage: 'good',
    irrigation_available: true, // Shallow tubewell irrigated
    current_season: 'Rabi',
    current_crop: 'Wheat', // Rabi winter cereal alternative to Boro
    current_crop_family: 'Cereal',
    previous_crop: 'T. Aman Rice', // Prior season Kharif-2 2023
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Pre-processed NASA observations',
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[
        [88.5810, 25.6270],
        [88.5830, 25.6270],
        [88.5830, 25.6290],
        [88.5810, 25.6290],
        [88.5810, 25.6270]
      ]]
    },
    history: [
      // 2019
      { year: 2019, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Rabi', crop: 'Wheat', crop_family: 'Cereal' },
      // 2020
      { year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Rabi', crop: 'Wheat', crop_family: 'Cereal' },
      // 2021
      { year: 2021, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Rabi', crop: 'Wheat', crop_family: 'Cereal' },
      // 2022
      { year: 2022, season: 'Kharif-1', crop: 'Maize', crop_family: 'Cereal' },
      { year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Rabi', crop: 'Potato', crop_family: 'Solanaceae' },
      // 2023
      { year: 2023, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Rabi', crop: 'Wheat', crop_family: 'Cereal' }
    ]
  },
  {
    name: 'Muktagacha Lowland Floodplain Basin (Mymensingh)',
    latitude: 24.7620,
    longitude: 90.2640,
    area_hectares: 0.95,
    soil_type: 'Clay Loam (Old Brahmaputra Floodplain)',
    soil_ph: 6.50,
    organic_matter_percent: 1.60,
    drainage: 'poor', // Waterlogging prone basin
    irrigation_available: true, // Surface canal & low-lift pump
    current_season: 'Rabi',
    current_crop: 'Boro Rice', // Rabi flooded paddy in lowland basin
    current_crop_family: 'Cereal',
    previous_crop: 'T. Aman Rice', // Prior season Kharif-2 2023
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Pre-processed NASA observations',
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[
        [90.2630, 24.7610],
        [90.2650, 24.7610],
        [90.2650, 24.7630],
        [90.2630, 24.7630],
        [90.2630, 24.7610]
      ]]
    },
    history: [
      // 2019
      { year: 2019, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Rabi', crop: 'Boro Rice', crop_family: 'Cereal' },
      // 2020
      { year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Rabi', crop: 'Boro Rice', crop_family: 'Cereal' },
      // 2021
      { year: 2021, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Rabi', crop: 'Boro Rice', crop_family: 'Cereal' },
      // 2022
      { year: 2022, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Rabi', crop: 'Mustard', crop_family: 'Oilseed' },
      // 2023
      { year: 2023, season: 'Kharif-1', crop: 'Jute', crop_family: 'Fibre' },
      { year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Rabi', crop: 'Boro Rice', crop_family: 'Cereal' }
    ]
  },
  {
    name: 'Jhikargacha High Ganges Floodplain (Jessore)',
    latitude: 23.1040,
    longitude: 89.1350,
    area_hectares: 1.50,
    soil_type: 'Calcareous Loam (High Ganges Floodplain)',
    soil_ph: 7.30,
    organic_matter_percent: 1.75,
    drainage: 'good',
    irrigation_available: true, // Deep tubewell
    current_season: 'Rabi',
    current_crop: 'Mustard', // Prime winter oilseed sandwich crop
    current_crop_family: 'Oilseed',
    previous_crop: 'T. Aman Rice', // Prior season Kharif-2 2023
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Pre-processed NASA observations',
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[
        [89.1340, 23.1030],
        [89.1360, 23.1030],
        [89.1360, 23.1050],
        [89.1340, 23.1050],
        [89.1340, 23.1030]
      ]]
    },
    history: [
      // 2019
      { year: 2019, season: 'Kharif-1', crop: 'Mung Bean', crop_family: 'Legume' },
      { year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Rabi', crop: 'Mustard', crop_family: 'Oilseed' },
      // 2020
      { year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2021
      { year: 2021, season: 'Kharif-1', crop: 'Mung Bean', crop_family: 'Legume' },
      { year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2022
      { year: 2022, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Rabi', crop: 'Mustard', crop_family: 'Oilseed' },
      // 2023
      { year: 2023, season: 'Kharif-1', crop: 'Mung Bean', crop_family: 'Legume' },
      { year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Rabi', crop: 'Mustard', crop_family: 'Oilseed' }
    ]
  },
  {
    name: 'Kaliganj Coastal Saline Transition (Satkhira)',
    latitude: 22.4530,
    longitude: 89.0340,
    area_hectares: 2.10,
    soil_type: 'Heavy Silty Clay (Ganges Tidal Floodplain)',
    soil_ph: 7.60,
    organic_matter_percent: 1.40,
    drainage: 'moderate',
    irrigation_available: false, // Saline dry season canal water
    current_season: 'Rabi',
    current_crop: 'Lentil', // Winter pulse utilizing residual moisture before peak salinity
    current_crop_family: 'Legume',
    previous_crop: 'T. Aman Rice', // Prior season Kharif-2 2023
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Simulated demonstration data', // Strictly labeled per Section 51
    boundary_geojson: {
      type: 'Polygon',
      coordinates: [[
        [89.0330, 22.4520],
        [89.0350, 22.4520],
        [89.0350, 22.4540],
        [89.0330, 22.4540],
        [89.0330, 22.4520]
      ]]
    },
    history: [
      // 2019
      { year: 2019, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2019, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2020
      { year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2020, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2021
      { year: 2021, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2021, season: 'Rabi', crop: 'Mustard', crop_family: 'Oilseed' },
      // 2022
      { year: 2022, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2022, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' },
      // 2023
      { year: 2023, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal' },
      { year: 2023, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume' }
    ]
  }
];

async function seedDemoFieldsData() {
  console.log(`[Seed Fields] Seeding ${DEMO_FIELDS.length} Bangladesh demo fields (Spec Section 51)...`);
  const seededFields = [];

  for (const fieldDef of DEMO_FIELDS) {
    const existingRes = await db.query('SELECT id FROM fields WHERE name = $1;', [fieldDef.name]);
    let field;
    if (existingRes.rows.length > 0) {
      field = await FieldsModel.update(existingRes.rows[0].id, fieldDef);
      console.log(`[Seed Fields] Updated existing demo field: ${field.name} (ID: ${field.id})`);
    } else {
      field = await FieldsModel.create(fieldDef);
      console.log(`[Seed Fields] Created demo field: ${field.name} (ID: ${field.id})`);
    }
    seededFields.push(field);

    // Seed crop history for this field
    if (fieldDef.history && fieldDef.history.length > 0) {
      for (const h of fieldDef.history) {
        const histExisting = await FieldCropHistoryModel.findByFieldAndSeason(field.id, h.year, h.season);
        if (!histExisting) {
          await FieldCropHistoryModel.create({
            field_id: field.id,
            year: h.year,
            season: h.season,
            crop: h.crop,
            crop_family: h.crop_family,
            source: 'hand-entered demo data' // Strictly labeled per Section 51
          });
        }
      }
    }
  }

  console.log(`[Seed Fields] Successfully seeded ${seededFields.length} demo fields with multi-year crop histories.`);
  return seededFields;
}

async function getSeededDemoFields() {
  return await FieldsModel.findAll({ isDemo: true });
}

if (require.main === module) {
  const { runMigration } = require('./migrate');
  const { seedReferenceData } = require('./seed_reference');
  const { seedCropsData } = require('./seed_crops');

  runMigration()
    .then(() => seedReferenceData())
    .then(() => seedCropsData())
    .then(() => seedDemoFieldsData())
    .then(async () => {
      const allFields = await getSeededDemoFields();
      console.log('\n========================================================================================');
      console.log('                          FIELD SHIFT - DEMO FIELDS TABLE (PHASE 3)');
      console.log('========================================================================================');
      console.table(
        allFields.map((f) => ({
          ID: f.id,
          Name: f.name,
          'Lat/Lon': `${Number(f.latitude).toFixed(3)}, ${Number(f.longitude).toFixed(3)}`,
          'Area (ha)': f.area_hectares,
          Soil: f.soil_type,
          pH: f.soil_ph,
          'OM %': f.organic_matter_percent,
          Drainage: f.drainage,
          Irrigated: f.irrigation_available,
          'Current Crop': `${f.current_crop} (${f.current_crop_family})`,
          'Prev Crop': `${f.previous_crop} (${f.previous_crop_family})`,
          Season: f.current_season,
          'Data Label': f.data_label
        }))
      );

      const idRows = await db.query('SELECT id, name FROM fields ORDER BY id ASC;');
      console.log('\nExact Field IDs:');
      console.table(idRows.rows);

      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Fields] Failed:', err);
      process.exit(1);
    });
}

module.exports = { DEMO_FIELDS, seedDemoFieldsData, getSeededDemoFields };

/**
 * Field Shift - Canonical Preloaded Initial Data
 * Enables instant 0ms first-paint and renders complete UI without waiting for network calls.
 * Values are strictly calibrated from Spec Section 51, 43, 26, 27 and authentic NASA observations.
 */

export const INITIAL_FIELDS = [
  {
    id: 1,
    name: 'Godagari Barind Terrace (Rajshahi)',
    latitude: 24.4715,
    longitude: 88.3325,
    area_hectares: 1.20,
    soil_type: 'Silty Clay Loam (Barind Red Clay)',
    soil_ph: 5.80,
    organic_matter_percent: 1.10,
    drainage: 'moderate',
    irrigation_available: false,
    current_season: 'Rabi',
    current_crop: 'Chickpea',
    current_crop_family: 'Legume',
    previous_crop: 'T. Aman Rice',
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
    nasa_metadata: {
      smap_product: 'SPL3SMP_E',
      smap_version: 'v006',
      gpm_product: '3IMERGHHL',
      gpm_version: 'v07B',
      gpm_latency_class: 'Early/Late',
      hls_product: 'HLSL30/HLS.S30',
      hls_version: 'v2.0',
      modis_product: 'MOD11A1/MYD11A1',
      modis_version: 'v061'
    },
    condition_score: {
      score: 48.12,
      label: 'Moderate stress',
      vegetation_score: 68.60,
      water_score: 3.10,
      heat_score: 87.70,
      data_quality_status: 'normal',
      window_start: '2023-12-30',
      window_end: '2024-02-28'
    }
  },
  {
    id: 2,
    name: 'Birol Piedmont Alluvial Plain (Dinajpur)',
    latitude: 25.6280,
    longitude: 88.5820,
    area_hectares: 1.80,
    soil_type: 'Sandy Loam (Old Himalayan Piedmont)',
    soil_ph: 5.40,
    organic_matter_percent: 1.35,
    drainage: 'good',
    irrigation_available: true,
    current_season: 'Rabi',
    current_crop: 'Wheat',
    current_crop_family: 'Cereal',
    previous_crop: 'T. Aman Rice',
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
    nasa_metadata: {
      smap_product: 'SPL3SMP_E',
      smap_version: 'v006',
      gpm_product: '3IMERGHHL',
      gpm_version: 'v07B',
      gpm_latency_class: 'Early/Late',
      hls_product: 'HLSL30/HLS.S30',
      hls_version: 'v2.0',
      modis_product: 'MOD11A1/MYD11A1',
      modis_version: 'v061'
    },
    condition_score: {
      score: 83.32,
      label: 'Healthy relative condition',
      vegetation_score: 98.10,
      water_score: 77.40,
      heat_score: 89.40,
      data_quality_status: 'normal',
      window_start: '2023-12-30',
      window_end: '2024-02-28'
    }
  },
  {
    id: 3,
    name: 'Muktagacha Lowland Floodplain Basin (Mymensingh)',
    latitude: 24.7620,
    longitude: 90.2640,
    area_hectares: 0.95,
    soil_type: 'Clay Loam (Old Brahmaputra Floodplain)',
    soil_ph: 6.50,
    organic_matter_percent: 1.60,
    drainage: 'poor',
    irrigation_available: true,
    current_season: 'Rabi',
    current_crop: 'Boro Rice',
    current_crop_family: 'Cereal',
    previous_crop: 'T. Aman Rice',
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
    nasa_metadata: {
      smap_product: 'SPL3SMP_E',
      smap_version: 'v006',
      gpm_product: '3IMERGHHL',
      gpm_version: 'v07B',
      gpm_latency_class: 'Early/Late',
      hls_product: 'HLSL30/HLS.S30',
      hls_version: 'v2.0',
      modis_product: 'MOD11A1/MYD11A1',
      modis_version: 'v061'
    },
    condition_score: {
      score: 51.17,
      label: 'Watch closely',
      vegetation_score: 13.80,
      water_score: 75.70,
      heat_score: 69.60,
      data_quality_status: 'normal',
      window_start: '2023-12-30',
      window_end: '2024-02-28'
    }
  },
  {
    id: 4,
    name: 'Jhikargacha High Ganges Floodplain (Jessore)',
    latitude: 23.1040,
    longitude: 89.1350,
    area_hectares: 1.50,
    soil_type: 'Calcareous Loam (High Ganges Floodplain)',
    soil_ph: 7.30,
    organic_matter_percent: 1.75,
    drainage: 'good',
    irrigation_available: true,
    current_season: 'Rabi',
    current_crop: 'Mustard',
    current_crop_family: 'Oilseed',
    previous_crop: 'T. Aman Rice',
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
    nasa_metadata: {
      smap_product: 'SPL3SMP_E',
      smap_version: 'v006',
      gpm_product: '3IMERGHHL',
      gpm_version: 'v07B',
      gpm_latency_class: 'Early/Late',
      hls_product: 'HLSL30/HLS.S30',
      hls_version: 'v2.0',
      modis_product: 'MOD11A1/MYD11A1',
      modis_version: 'v061'
    },
    condition_score: {
      score: 50.23,
      label: 'Watch closely',
      vegetation_score: 66.00,
      water_score: 49.00,
      heat_score: 65.10,
      data_quality_status: 'normal',
      window_start: '2023-12-30',
      window_end: '2024-02-28'
    }
  },
  {
    id: 5,
    name: 'Kaliganj Coastal Saline Transition (Satkhira)',
    latitude: 22.4530,
    longitude: 89.0340,
    area_hectares: 2.10,
    soil_type: 'Heavy Silty Clay (Ganges Tidal Floodplain)',
    soil_ph: 7.60,
    organic_matter_percent: 1.40,
    drainage: 'moderate',
    irrigation_available: false,
    current_season: 'Rabi',
    current_crop: 'Lentil',
    current_crop_family: 'Legume',
    previous_crop: 'T. Aman Rice',
    previous_crop_family: 'Cereal',
    is_demo: true,
    data_label: 'Simulated demonstration data',
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
    nasa_metadata: {
      smap_product: 'SPL3SMP_E',
      smap_version: 'v006',
      gpm_product: '3IMERGHHL',
      gpm_version: 'v07B',
      gpm_latency_class: 'Early/Late',
      hls_product: 'HLSL30/HLS.S30',
      hls_version: 'v2.0',
      modis_product: 'MOD11A1/MYD11A1',
      modis_version: 'v061'
    },
    condition_score: {
      score: 23.92,
      label: 'High stress',
      vegetation_score: 0.00,
      water_score: 0.20,
      heat_score: 79.50,
      data_quality_status: 'normal',
      window_start: '2023-12-30',
      window_end: '2024-02-28'
    }
  }
];

export const INITIAL_CROPS = [
  { id: 1, name: 'Rice', crop_family: 'Cereal', water_demand: 75.0, heat_tolerance: 50.0, soil_health_benefit: 25.0, diversity_value: 25.0, growing_days: 115, suitable_seasons: ['Kharif-1', 'Kharif-2'] },
  { id: 2, name: 'Boro Rice', crop_family: 'Cereal', water_demand: 75.0, heat_tolerance: 50.0, soil_health_benefit: 25.0, diversity_value: 25.0, growing_days: 145, suitable_seasons: ['Rabi'] },
  { id: 3, name: 'T. Aman Rice', crop_family: 'Cereal', water_demand: 75.0, heat_tolerance: 50.0, soil_health_benefit: 25.0, diversity_value: 25.0, growing_days: 115, suitable_seasons: ['Kharif-2'] },
  { id: 4, name: 'Aus Rice', crop_family: 'Cereal', water_demand: 50.0, heat_tolerance: 50.0, soil_health_benefit: 25.0, diversity_value: 25.0, growing_days: 108, suitable_seasons: ['Kharif-1'] },
  { id: 5, name: 'Mung Bean', crop_family: 'Legume', water_demand: 25.0, heat_tolerance: 75.0, soil_health_benefit: 75.0, diversity_value: 75.0, growing_days: 65, suitable_seasons: ['Kharif-1', 'Kharif-2', 'Rabi'] },
  { id: 6, name: 'Lentil', crop_family: 'Legume', water_demand: 25.0, heat_tolerance: 25.0, soil_health_benefit: 75.0, diversity_value: 75.0, growing_days: 110, suitable_seasons: ['Rabi'] },
  { id: 7, name: 'Mustard', crop_family: 'Oilseed', water_demand: 25.0, heat_tolerance: 50.0, soil_health_benefit: 50.0, diversity_value: 75.0, growing_days: 80, suitable_seasons: ['Rabi'] },
  { id: 8, name: 'Wheat', crop_family: 'Cereal', water_demand: 50.0, heat_tolerance: 50.0, soil_health_benefit: 25.0, diversity_value: 25.0, growing_days: 108, suitable_seasons: ['Rabi'] },
  { id: 9, name: 'Maize', crop_family: 'Cereal', water_demand: 75.0, heat_tolerance: 75.0, soil_health_benefit: 50.0, diversity_value: 25.0, growing_days: 115, suitable_seasons: ['Rabi', 'Kharif-1'] },
  { id: 10, name: 'Jute', crop_family: 'Fibre', water_demand: 50.0, heat_tolerance: 75.0, soil_health_benefit: 75.0, diversity_value: 75.0, growing_days: 115, suitable_seasons: ['Kharif-1'] },
  { id: 11, name: 'Potato', crop_family: 'Solanaceae', water_demand: 50.0, heat_tolerance: 25.0, soil_health_benefit: 25.0, diversity_value: 75.0, growing_days: 90, suitable_seasons: ['Rabi'] },
  { id: 12, name: 'Chickpea', crop_family: 'Legume', water_demand: 25.0, heat_tolerance: 50.0, soil_health_benefit: 75.0, diversity_value: 75.0, growing_days: 115, suitable_seasons: ['Rabi'] }
];

export const INITIAL_HISTORY = [
  { id: 1, year: 2019, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 2, year: 2019, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 3, year: 2019, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume', source: 'hand-entered demo data' },
  { id: 4, year: 2020, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 5, year: 2020, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 6, year: 2020, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume', source: 'hand-entered demo data' },
  { id: 7, year: 2021, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 8, year: 2021, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 9, year: 2021, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume', source: 'hand-entered demo data' },
  { id: 10, year: 2022, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 11, year: 2022, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 12, year: 2022, season: 'Rabi', crop: 'Lentil', crop_family: 'Legume', source: 'hand-entered demo data' },
  { id: 13, year: 2023, season: 'Kharif-1', crop: 'Aus Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 14, year: 2023, season: 'Kharif-2', crop: 'T. Aman Rice', crop_family: 'Cereal', source: 'hand-entered demo data' },
  { id: 15, year: 2023, season: 'Rabi', crop: 'Chickpea', crop_family: 'Legume', source: 'hand-entered demo data' }
];

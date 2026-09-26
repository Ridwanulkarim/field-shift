/**
 * Field Shift - Unified NASA Access Service (Phase 4)
 * Coordinates server-side Earthdata authentication and structured subset queries
 * for HLS-VI, SMAP, MODIS LST, and GPM IMERG.
 */
const config = require('../../config');
const auth = require('./earthdataAuth');
const cmr = require('./cmrClient');
const appeears = require('./appeearsClient');
const gpm = require('./gpmClient');

class NasaAccessService {
  constructor() {
    this.auth = auth;
    this.cmr = cmr;
    this.appeears = appeears;
    this.gpm = gpm;
  }

  /**
   * Builds the complete, verified NASA spatial/temporal subset request plan
   * for a given field and anchor date.
   */
  buildFieldSubsetPlan(field, anchorDateStr = config.DEMO_ANCHOR_DATE) {
    const anchor = new Date(anchorDateStr);
    
    // Windows per Spec Section 8
    // 1. Primary 30-day window (HLS)
    const d30Start = new Date(anchor);
    d30Start.setDate(anchor.getDate() - 30);

    // 2. 60-day window (HLS fallback, SMAP, MODIS, GPM analysis)
    const d60Start = new Date(anchor);
    d60Start.setDate(anchor.getDate() - 60);

    // Formatted dates for AppEEARS (MM-DD-YYYY) and ISO
    const formatAppEEARS = (d) => {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${mm}-${dd}-${yyyy}`;
    };

    const formatISO = (d) => d.toISOString().split('T')[0];

    const lat = Number(field.latitude);
    const lon = Number(field.longitude);

    // HLS AppEEARS task payload
    const hlsPrimaryAppEEARS = this.appeears.buildPointTaskPayload({
      taskName: `HLS_30d_${field.name}`,
      latitude: lat,
      longitude: lon,
      startDate: formatAppEEARS(d30Start),
      endDate: formatAppEEARS(anchor),
      layers: [
        { product: 'HLSL30_VI.002', layer: 'NDVI' },
        { product: 'HLSL30_VI.002', layer: 'EVI' },
        { product: 'HLSL30_VI.002', layer: 'NDMI' },
        { product: 'HLSS30_VI.002', layer: 'NDVI' },
        { product: 'HLSS30_VI.002', layer: 'EVI' },
        { product: 'HLSS30_VI.002', layer: 'NDMI' }
      ]
    });

    const hlsFallbackAppEEARS = this.appeears.buildPointTaskPayload({
      taskName: `HLS_60d_${field.name}`,
      latitude: lat,
      longitude: lon,
      startDate: formatAppEEARS(d60Start),
      endDate: formatAppEEARS(anchor),
      layers: [
        { product: 'HLSL30_VI.002', layer: 'NDVI' },
        { product: 'HLSL30_VI.002', layer: 'EVI' },
        { product: 'HLSL30_VI.002', layer: 'NDMI' },
        { product: 'HLSS30_VI.002', layer: 'NDVI' },
        { product: 'HLSS30_VI.002', layer: 'EVI' },
        { product: 'HLSS30_VI.002', layer: 'NDMI' }
      ]
    });

    // SMAP AppEEARS task payload (60 days)
    const smapAppEEARS = this.appeears.buildPointTaskPayload({
      taskName: `SMAP_60d_${field.name}`,
      latitude: lat,
      longitude: lon,
      startDate: formatAppEEARS(d60Start),
      endDate: formatAppEEARS(anchor),
      layers: [
        { product: 'SPL3SMP_E.006', layer: 'Soil_Moisture_AM' },
        { product: 'SPL3SMP_E.006', layer: 'Soil_Moisture_PM' },
        { product: 'SPL3SMP_E.006', layer: 'Quality_Flag_AM' },
        { product: 'SPL3SMP_E.006', layer: 'Quality_Flag_PM' }
      ]
    });

    // MODIS Daytime LST AppEEARS task payload (60 days)
    const modisAppEEARS = this.appeears.buildPointTaskPayload({
      taskName: `MODIS_60d_${field.name}`,
      latitude: lat,
      longitude: lon,
      startDate: formatAppEEARS(d60Start),
      endDate: formatAppEEARS(anchor),
      layers: [
        { product: 'MOD11A1.061', layer: 'LST_Day_1km' },
        { product: 'MOD11A1.061', layer: 'QC_Day' },
        { product: 'MYD11A1.061', layer: 'LST_Day_1km' },
        { product: 'MYD11A1.061', layer: 'QC_Day' }
      ]
    });

    // GPM 90-day fetch plan
    const gpmPlan = this.gpm.buildCmrQuery({
      latitude: lat,
      longitude: lon,
      anchorDate: formatISO(anchor)
    });

    return {
      fieldId: field.id,
      fieldName: field.name,
      coordinates: { latitude: lat, longitude: lon },
      anchorDate: formatISO(anchor),
      products: {
        hls: {
          productIds: ['HLSL30_VI.002', 'HLSS30_VI.002'],
          primaryWindow: {
            start: formatISO(d30Start),
            end: formatISO(anchor),
            days: 30,
            appeearsPayload: hlsPrimaryAppEEARS,
            cmrQueryUrl: this.cmr.buildQueryUrl({
              shortName: 'HLSL30_VI',
              version: '2.0',
              latitude: lat,
              longitude: lon,
              startDate: `${formatISO(d30Start)}T00:00:00Z`,
              endDate: `${formatISO(anchor)}T23:59:59Z`
            })
          },
          fallbackWindow: {
            start: formatISO(d60Start),
            end: formatISO(anchor),
            days: 60,
            appeearsPayload: hlsFallbackAppEEARS,
            cmrQueryUrl: this.cmr.buildQueryUrl({
              shortName: 'HLSL30_VI',
              version: '2.0',
              latitude: lat,
              longitude: lon,
              startDate: `${formatISO(d60Start)}T00:00:00Z`,
              endDate: `${formatISO(anchor)}T23:59:59Z`
            })
          }
        },
        smap: {
          productId: 'SPL3SMP_E.006',
          window: {
            start: formatISO(d60Start),
            end: formatISO(anchor),
            days: 60,
            appeearsPayload: smapAppEEARS,
            cmrQueryUrl: this.cmr.buildQueryUrl({
              shortName: 'SPL3SMP_E',
              version: '006',
              latitude: lat,
              longitude: lon,
              startDate: `${formatISO(d60Start)}T00:00:00Z`,
              endDate: `${formatISO(anchor)}T23:59:59Z`
            })
          }
        },
        modis: {
          productIds: ['MOD11A1.061', 'MYD11A1.061'],
          window: {
            start: formatISO(d60Start),
            end: formatISO(anchor),
            days: 60,
            appeearsPayload: modisAppEEARS,
            cmrQueryUrl: this.cmr.buildQueryUrl({
              shortName: 'MOD11A1',
              version: '061',
              latitude: lat,
              longitude: lon,
              startDate: `${formatISO(d60Start)}T00:00:00Z`,
              endDate: `${formatISO(anchor)}T23:59:59Z`
            })
          }
        },
        gpm: gpmPlan
      }
    };
  }
}

module.exports = new NasaAccessService();

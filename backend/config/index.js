/**
 * Field Shift - Core Configuration Constants (v6.2)
 * All values verified and decided in Phase 0.
 */
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || null,

  // Spec Section 6: Earthdata Server-Side Authentication
  EARTHDATA_USERNAME: process.env.EARTHDATA_USERNAME || '',
  EARTHDATA_PASSWORD: process.env.EARTHDATA_PASSWORD || '',
  EARTHDATA_TOKEN: process.env.EARTHDATA_TOKEN || '',

  // Spec Section 7 & Phase 0 Decision:
  DEMO_ANCHOR_DATE: process.env.DEMO_ANCHOR_DATE || '2024-02-28',

  // Spec Section 9 & Phase 0 Decision:
  MIN_VALID_OBS_HLS: {
    PRIMARY_30D: 3,
    FALLBACK_60D: 5
  },
  MIN_VALID_OBS_SMAP: 10,
  MIN_VALID_OBS_MODIS: 15,
  MIN_VALID_OBS_GPM: 50,

  // Spec Section 29:
  ALLOW_SEASON_OVERLAP: false,

  // Spec Section 43 & 48:
  SCORING_VERSION: 'v6.2',

  // Test Area Default (Chattogram, Bangladesh)
  DEFAULT_TEST_POINT: {
    name: 'Chattogram Test Area',
    latitude: 22.3569,
    longitude: 91.7832,
    mgrsTile: 'T46QCK',
    modisTile: 'h26v06'
  }
};

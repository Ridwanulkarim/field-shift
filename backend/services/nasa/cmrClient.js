/**
 * Field Shift - NASA CMR (Common Metadata Repository) Client (Spec Section 5, 6, 8)
 * Queries NASA CMR API for granule discovery and temporal/spatial availability checks.
 */
const auth = require('./earthdataAuth');

const CMR_ENDPOINT = 'https://cmr.earthdata.nasa.gov/search/granules.json';

class CmrClient {
  /**
   * Search granules for a given collection, spatial boundary, and date range.
   * @param {Object} options
   * @param {string} options.shortName e.g. 'HLSL30_VI'
   * @param {string} options.version e.g. '2.0' or '006'
   * @param {number} options.latitude
   * @param {number} options.longitude
   * @param {string} options.startDate ISO string e.g. '2024-01-01T00:00:00Z'
   * @param {string} options.endDate ISO string e.g. '2024-02-28T23:59:59Z'
   * @param {number} [options.pageSize=20]
   */
  async searchGranules({
    shortName,
    version,
    latitude,
    longitude,
    startDate,
    endDate,
    pageSize = 20
  }) {
    const params = new URLSearchParams();
    params.append('short_name', shortName);
    if (version) params.append('version', version);
    if (latitude !== undefined && longitude !== undefined) {
      params.append('point', `${longitude},${latitude}`);
    }
    if (startDate && endDate) {
      params.append('temporal', `${startDate},${endDate}`);
    }
    params.append('page_size', String(pageSize));
    params.append('sort_key', '-start_date');

    const url = `${CMR_ENDPOINT}?${params.toString()}`;
    const headers = await auth.getAuthHeaders();
    headers['Accept'] = 'application/json';

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`CMR query failed with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const entries = data.feed?.entry || [];
      return {
        queryUrl: url,
        totalFound: entries.length,
        granules: entries.map(g => ({
          id: g.id,
          title: g.title,
          timeStart: g.time_start,
          timeEnd: g.time_end,
          downloadUrl: g.links?.find(l => l.rel?.includes('data#'))?.href || null
        }))
      };
    } catch (err) {
      // In offline / sandboxed environments, return structured query payload with status
      return {
        queryUrl: url,
        totalFound: 0,
        error: err.message,
        isOffline: true
      };
    }
  }

  /**
   * Builds the exact CMR query URL for verification / inspection
   */
  buildQueryUrl({ shortName, version, latitude, longitude, startDate, endDate }) {
    const params = new URLSearchParams();
    params.append('short_name', shortName);
    if (version) params.append('version', version);
    if (latitude !== undefined && longitude !== undefined) {
      params.append('point', `${longitude},${latitude}`);
    }
    if (startDate && endDate) {
      params.append('temporal', `${startDate},${endDate}`);
    }
    return `${CMR_ENDPOINT}?${params.toString()}`;
  }
}

module.exports = new CmrClient();

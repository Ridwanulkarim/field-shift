/**
 * Field Shift - NASA GPM Precipitation Service (Spec Section 8, 43)
 * Handles GPM IMERG Daily (GPM_3IMERGDF.07) temporal fetch windows & OPeNDAP/CMR query syntax.
 * Spec Rule: "60-day analysis, 30-day lead-in, 90-day fetch."
 */
const cmr = require('./cmrClient');

class GpmClient {
  /**
   * Calculates the exact GPM 90-day fetch window from an anchor date.
   * Lead-in: 30 days before analysis window (for rolling 30-day rainfall calculation).
   * Analysis: 60 days up to anchor date.
   * Total fetch: 90 days.
   */
  calculateWindows(anchorDateStr = '2024-02-28') {
    const anchor = new Date(anchorDateStr);
    
    // Analysis window: anchor - 60 days
    const analysisStart = new Date(anchor);
    analysisStart.setDate(anchor.getDate() - 60);

    // Fetch window (with 30d lead-in): anchor - 90 days
    const fetchStart = new Date(anchor);
    fetchStart.setDate(anchor.getDate() - 90);

    return {
      anchorDate: anchor.toISOString().split('T')[0],
      analysisWindow: {
        start: analysisStart.toISOString().split('T')[0],
        end: anchor.toISOString().split('T')[0],
        days: 60
      },
      fetchWindow: {
        start: fetchStart.toISOString().split('T')[0],
        end: anchor.toISOString().split('T')[0],
        days: 90,
        leadInDays: 30
      }
    };
  }

  /**
   * Builds CMR search query for GPM Daily Final granules
   */
  buildCmrQuery({ latitude, longitude, anchorDate = '2024-02-28' }) {
    const windows = this.calculateWindows(anchorDate);
    const startDate = `${windows.fetchWindow.start}T00:00:00Z`;
    const endDate = `${windows.fetchWindow.end}T23:59:59Z`;

    return {
      windows,
      queryUrl: cmr.buildQueryUrl({
        shortName: 'GPM_3IMERGDF',
        version: '07',
        latitude,
        longitude,
        startDate,
        endDate
      }),
      latencyClass: 'final', // 3.5 month latency, historical 2024 is Final
      dataset: 'GPM_3IMERGDF.07'
    };
  }
}

module.exports = new GpmClient();

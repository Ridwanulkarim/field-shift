/**
 * Field Shift - NASA AppEEARS Client (Spec Section 5, 6, 8)
 * Point extraction and spatial/temporal subsetting via NASA LP DAAC AppEEARS API.
 */
const auth = require('./earthdataAuth');

const APPEEARS_API_BASE = 'https://appeears.earthdatacloud.nasa.gov/api/v1';

class AppEEARSClient {
  /**
   * Formats a point extraction task payload per AppEEARS API specification.
   */
  buildPointTaskPayload({
    taskName,
    latitude,
    longitude,
    startDate, // MM-DD-YYYY per AppEEARS spec
    endDate,   // MM-DD-YYYY per AppEEARS spec
    layers = [
      { product: 'HLSL30_VI.002', layer: 'NDVI' },
      { product: 'HLSL30_VI.002', layer: 'EVI' },
      { product: 'HLSL30_VI.002', layer: 'NDMI' },
      { product: 'HLSS30_VI.002', layer: 'NDVI' },
      { product: 'HLSS30_VI.002', layer: 'EVI' },
      { product: 'HLSS30_VI.002', layer: 'NDMI' },
      { product: 'MOD11A1.061', layer: 'LST_Day_1km' },
      { product: 'MOD11A1.061', layer: 'QC_Day' },
      { product: 'MYD11A1.061', layer: 'LST_Day_1km' },
      { product: 'MYD11A1.061', layer: 'QC_Day' },
      { product: 'SPL3SMP_E.006', layer: 'Soil_Moisture_AM' },
      { product: 'SPL3SMP_E.006', layer: 'Quality_Flag_AM' }
    ]
  }) {
    return {
      task_type: 'point',
      task_name: taskName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40),
      params: {
        dates: [
          {
            startDate,
            endDate
          }
        ],
        layers,
        coordinates: [
          {
            id: 'point_0',
            latitude: Number(latitude),
            longitude: Number(longitude)
          }
        ]
      }
    };
  }

  /**
   * Submits a point extraction task to AppEEARS.
   */
  async submitPointTask(payload) {
    const headers = await auth.getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    if (!headers['Authorization']) {
      return {
        task_id: null,
        status: 'unauthenticated',
        message: 'No Earthdata credentials configured. Please set EARTHDATA_TOKEN or EARTHDATA_USERNAME/PASSWORD.',
        payload
      };
    }

    try {
      const response = await fetch(`${APPEEARS_API_BASE}/task`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`AppEEARS task submission failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        task_id: data.task_id,
        status: data.status || 'submitted',
        payload
      };
    } catch (err) {
      return {
        task_id: null,
        status: 'error',
        error: err.message,
        payload
      };
    }
  }

  /**
   * Retrieves task progress / status from AppEEARS.
   */
  async getTaskStatus(taskId) {
    if (!taskId) return { status: 'invalid_task_id' };
    const headers = await auth.getAuthHeaders();

    try {
      const response = await fetch(`${APPEEARS_API_BASE}/task/${taskId}`, { headers });
      if (!response.ok) {
        throw new Error(`Failed to query task status: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  }
}

module.exports = new AppEEARSClient();

/**
 * Field Shift - NASA Earthdata Authentication Service (Spec Section 6)
 * Server-side authentication management for NASA Earthdata & AppEEARS API.
 * Never expose credentials to frontend. Never log secrets.
 */
const config = require('../../config');

class EarthdataAuth {
  constructor() {
    this.token = config.EARTHDATA_TOKEN || null;
    this.tokenExpiry = null;
    this.appeearsLoginUrl = 'https://appeears.earthdatacloud.nasa.gov/api/v1/login';
  }

  hasCredentials() {
    return Boolean(
      config.EARTHDATA_TOKEN || 
      (config.EARTHDATA_USERNAME && config.EARTHDATA_PASSWORD)
    );
  }

  async getValidToken() {
    // 1. Direct Bearer token provided in environment
    if (config.EARTHDATA_TOKEN) {
      return config.EARTHDATA_TOKEN;
    }

    // 2. Cached token still valid
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    // 3. Username + password exchange via AppEEARS login endpoint
    if (config.EARTHDATA_USERNAME && config.EARTHDATA_PASSWORD) {
      return await this.loginAppEEARS(config.EARTHDATA_USERNAME, config.EARTHDATA_PASSWORD);
    }

    return null;
  }

  async loginAppEEARS(username, password) {
    try {
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
      const response = await fetch(this.appeearsLoginUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Length': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`Earthdata login failed with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      // AppEEARS tokens typically expire in 48 hours; cache for 40 hours
      this.tokenExpiry = Date.now() + (40 * 60 * 60 * 1000);
      return this.token;
    } catch (err) {
      throw new Error(`Earthdata authentication error: ${err.message}`);
    }
  }

  async getAuthHeaders() {
    const token = await this.getValidToken();
    if (!token) {
      return {};
    }
    return {
      'Authorization': `Bearer ${token}`
    };
  }
}

module.exports = new EarthdataAuth();

// Lists what ClimateSERV says it offers, so the datatype numbers for other products (for example the CHIRPS-GEFS 10-day
// rainfall forecast) can be read from the service itself instead of guessed. Read-only; needs internet access.
//
//   npm run probe:climateserv
// It prints the raw answers of getParameterTypes, getClimateScenarioInfo and getFeatureLayers (the three list endpoints in the
// ClimateSERV API documentation). Paste the output back before any forecast code is written: the documentation page does not
// list the datatype numbers for the forecast products, and this project does not guess them.
import { CLIMATESERV_BASE } from '../src/integrations/climateserv/climateserv.js';

for (const method of ['getParameterTypes', 'getClimateScenarioInfo', 'getFeatureLayers']) {
  const url = `${CLIMATESERV_BASE}/${method}/`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const text = await res.text();
    console.log(`\n=== ${method}  (HTTP ${res.status}) ===`);
    try { console.log(JSON.stringify(JSON.parse(text), null, 1).slice(0, 6000)); } catch { console.log(text.slice(0, 1500)); }
  } catch (error) {
    console.log(`\n=== ${method} FAILED: ${error.message} ===`);
  }
}

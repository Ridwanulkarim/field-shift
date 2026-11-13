import { Router } from 'express';
import { parseEvaluateRequest } from '../validation/evaluateRequest.js';
import { unavailable } from '../utils/errors.js';
import { parseDailyClimateRequest } from '../validation/dailyClimateRequest.js';
import { parsePlantingWindowRequest } from '../validation/plantingWindowRequest.js';
import { parseAdvisoryRequest } from '../validation/advisoryRequest.js';
import crypto from 'node:crypto';
import {
  PRIORITIES,
  PRIORITY_MIN,
  PRIORITY_MAX,
  PRIORITY_DEFAULT,
  IRRIGATION_OPTIONS,
  SALINITY_OPTIONS,
  DRAINAGE_OPTIONS,
  DISCLAIMER,
} from '../science/rules.js';

// Routes that need the data layer. `service` is null when no database is configured.
export function createApiRouter(service) {
  const router = Router();

  const need = () => {
    if (!service) throw unavailable('No database connection is configured.');
    return service;
  };

  // GET /api/meta : options for the form
  router.get('/meta', (req, res) => {
    res.json({
      priorities: PRIORITIES,
      priorityRange: { min: PRIORITY_MIN, max: PRIORITY_MAX, default: PRIORITY_DEFAULT },
      options: { irrigation: IRRIGATION_OPTIONS, salinity: SALINITY_OPTIONS, drainage: DRAINAGE_OPTIONS },
      disclaimer: DISCLAIMER,
    });
  });

  // GET /api/districts
  router.get('/districts', async (req, res) => {
    res.json({ districts: await need().listDistricts() });
  });

  // GET /api/districts/:slug/climate
  router.get('/districts/:slug/climate', async (req, res) => {
    res.json(await need().climateSummary(req.params.slug));
  });

  router.get('/districts/:slug/climate/daily', async (req, res) => {
    const result = await need().dailyClimate(req.params.slug, parseDailyClimateRequest(req.query));
    const etag = `"${crypto.createHash('sha256').update(`${result.provenance.runId}:${result.from}:${result.to}`).digest('hex')}"`;
    res.set('Cache-Control', 'public, max-age=300');
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    return res.json(result);
  });

  // GET /api/districts/:slug/planting-window?crop=aman[&split=2013]
  router.get('/districts/:slug/planting-window', async (req, res) => {
    const input = parsePlantingWindowRequest(req.query);
    const result = await need().plantingWindow(req.params.slug, input);
    const etag = `"${crypto.createHash('sha256').update(`${result.provenance.runId}:${result.crop.slug}:${result.periods.splitYear}`).digest('hex')}"`;
    res.set('Cache-Control', 'public, max-age=300');
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    return res.json(result);
  });

  // GET /api/districts/:slug/advisory?crop=aman[&lang=bn][&split=2013][&usualFrom=07-15&usualTo=08-15]
  // The planting-window result as one decision: shift in days, revised window, the two distributions, a sentence in two languages.
  router.get('/districts/:slug/advisory', async (req, res) => {
    const input = parseAdvisoryRequest(req.query);
    const result = await need().advisory(req.params.slug, input);
    const etag = `"${crypto.createHash('sha256').update(JSON.stringify([result.provenance.runId, result.crop.slug, result.evidence.periods.splitYear, input.lang, input.usual])).digest('hex')}"`;
    res.set('Cache-Control', 'public, max-age=300');
    res.set('ETag', etag);
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    return res.json(result);
  });

  // GET /api/crops
  router.get('/crops', async (req, res) => {
    res.json({ crops: await need().listCrops() });
  });

  // GET /api/crops/advisory-supported : every crop in the planner catalogue, with advisoryAvailable
  // false for rain-independent crops whose result is explicitly "not applicable".
  router.get('/crops/advisory-supported', async (req, res) => {
    res.json({ crops: await need().listAdvisoryCrops() });
  });

  // GET /api/crops/compatibility : for every crop, the crops that can share a year with it (used to filter the planner's pickers)
  router.get('/crops/compatibility', async (req, res) => {
    res.json(await need().cropCompatibility());
  });

  // POST /api/evaluate
  router.post('/evaluate', async (req, res) => {
    const input = parseEvaluateRequest(req.body);
    res.json(await need().evaluate(input, req.anonymousSessionId));
  });

  return router;
}
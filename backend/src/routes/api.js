import { Router } from 'express';
import { parseEvaluateRequest } from '../validation/evaluateRequest.js';
import { unavailable } from '../utils/errors.js';
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

  // GET /api/crops
  router.get('/crops', async (req, res) => {
    res.json({ crops: await need().listCrops() });
  });

  // POST /api/evaluate
  router.post('/evaluate', async (req, res) => {
    const input = parseEvaluateRequest(req.body);
    res.json(await need().evaluate(input));
  });

  return router;
}

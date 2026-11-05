import { Router } from 'express';
import { parseFieldId, parseFieldRequest } from '../validation/fieldRequest.js';
import { unavailable } from '../utils/errors.js';
import { parseDailyClimateRequest } from '../validation/dailyClimateRequest.js';

export function createFieldRouter(service) {
  const router = Router();
  const need = () => {
    if (!service) throw unavailable('No database connection is configured.');
    return service;
  };

  router.post('/fields', async (req, res) => {
    res.status(201).json({ field: await need().createField(parseFieldRequest(req.body), req.anonymousSessionId) });
  });

  router.get('/fields', async (req, res) => {
    res.json({ fields: await need().listFields(req.anonymousSessionId) });
  });

  router.get('/fields/:id', async (req, res) => {
    res.json({ field: await need().getField(parseFieldId(req.params.id), req.anonymousSessionId) });
  });

  // GET /api/fields/:id/climate?from=YYYY-MM-DD&to=YYYY-MM-DD : climate of the grid cell containing the field
  router.get('/fields/:id/climate', async (req, res) => {
    const id = parseFieldId(req.params.id);
    const range = parseDailyClimateRequest(req.query);
    res.set('Cache-Control', 'private, no-store');
    res.json(await need().getFieldClimate(id, req.anonymousSessionId, range));
  });

  // GET /api/fields/:id/intelligence : evidence for one field (climate of its grid cell, per-crop context, soil as entered)
  router.get('/fields/:id/intelligence', async (req, res) => {
    const id = parseFieldId(req.params.id);
    res.set('Cache-Control', 'private, no-store');
    res.json(await need().getFieldIntelligence(id, req.anonymousSessionId));
  });

  router.patch('/fields/:id', async (req, res) => {
    res.json({ field: await need().updateField(parseFieldId(req.params.id), parseFieldRequest(req.body, { partial: true }), req.anonymousSessionId) });
  });

  router.delete('/fields/:id', async (req, res) => {
    res.json({ deleted: await need().deleteField(parseFieldId(req.params.id), req.anonymousSessionId) });
  });

  return router;
}

import { Router } from 'express';
import { parseFieldId, parseFieldRequest } from '../validation/fieldRequest.js';
import { unavailable } from '../utils/errors.js';

export function createFieldRouter(service) {
  const router = Router();
  const need = () => {
    if (!service) throw unavailable('No database connection is configured.');
    return service;
  };

  router.post('/fields', async (req, res) => {
    res.status(201).json({ field: await need().createField(parseFieldRequest(req.body)) });
  });

  router.get('/fields', async (req, res) => {
    res.json({ fields: await need().listFields() });
  });

  router.get('/fields/:id', async (req, res) => {
    res.json({ field: await need().getField(parseFieldId(req.params.id)) });
  });

  router.patch('/fields/:id', async (req, res) => {
    res.json({ field: await need().updateField(parseFieldId(req.params.id), parseFieldRequest(req.body, { partial: true })) });
  });

  router.delete('/fields/:id', async (req, res) => {
    res.json({ deleted: await need().deleteField(parseFieldId(req.params.id)) });
  });

  return router;
}

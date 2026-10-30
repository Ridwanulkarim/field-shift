import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { createHealthRouter } from './routes/health.js';
import { createApiRouter } from './routes/api.js';
import { createEvaluationService } from './services/evaluationService.js';
import { HttpError } from './utils/errors.js';

// Builds the Express app WITHOUT starting a server, so tests can call it directly.
// `repository` is optional: without it the data routes answer 503 instead of pretending.
export function createApp(config, { repository } = {}) {
  const app = express();
  const service = repository ? createEvaluationService(repository) : null;

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', createHealthRouter(repository));
  app.use('/api', createApiRouter(service));

  // Optional: serve the built frontend from this same server (handy for an offline demo).
  if (config.frontendDist && fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.resolve(config.frontendDist, 'index.html')));
  }

  // Unknown URL -> consistent JSON 404 (not Express's default HTML page).
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` },
    });
  });

  // Every error ends here with the same shape: { error: { code, message, details? } }.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' } });
    }
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' } });
  });

  return app;
}

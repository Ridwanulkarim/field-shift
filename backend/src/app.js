import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { createHealthRouter } from './routes/health.js';
import { createApiRouter } from './routes/api.js';
import { createEvaluationService } from './services/evaluationService.js';
import { createFieldService } from './services/fieldService.js';
import { createFieldRouter } from './routes/fields.js';
import { HttpError } from './utils/errors.js';

// Builds the Express app WITHOUT starting a server, so tests can call it directly.
// `repository` is optional: without it the data routes answer 503 instead of pretending.
export function createApp(config, { repository, fieldService } = {}) {
  const app = express();
  const service = repository ? createEvaluationService(repository) : null;
  const fields = fieldService ?? (repository ? createFieldService(repository) : null);

  const rateLimits = new Map();
  const rateLimit = (req, res, next) => {
    const now = Date.now();
    const windowMs = 60_000;
    const mutating = ['POST', 'PATCH', 'DELETE'].includes(req.method);
    const limit = mutating ? 60 : 300;
    const key = `${req.ip}:${mutating ? 'write' : 'read'}`;
    const current = rateLimits.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      rateLimits.set(key, { startedAt: now, count: 1 });
      return next();
    }
    if (current.count >= limit) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - current.startedAt)) / 1000)));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again shortly.' } });
    }
    current.count += 1;
    return next();
  };

  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit);

  app.use('/api/health', createHealthRouter(repository));
  app.use('/api', createApiRouter(service));
  app.use('/api', createFieldRouter(fields));

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

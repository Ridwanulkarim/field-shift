import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import crypto from 'node:crypto';
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
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    const supplied = req.get('Cookie')?.match(/(?:^|;\s*)field_shift_session=([^;]+)/)?.[1] ?? null;
    const sessionId = parseSessionCookie(supplied, config) ?? createSessionId(config);
    req.anonymousSessionId = sessionId;
    if (sessionId !== supplied) {
      const maxAge = config.anonymousSessionMaxAgeMs;
      const secure = config.nodeEnv === 'production' ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        `field_shift_session=${sessionId}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure}`,
      );
    }
    next();
  });
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) {
      const origin = req.get('Origin');
      if (origin && origin !== config.corsOrigin) {
        return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'The request origin is not allowed.' } });
      }
    }
    return next();
  });
  app.use(rateLimit);

  app.use('/api/health', createHealthRouter(repository));
  app.use('/api', createApiRouter(service));
  app.use('/api', createFieldRouter(fields));

  // Optional: serve the built frontend from this same server (handy for an offline demo).
  if (config.frontendDist && fs.existsSync(path.join(config.frontendDist, 'index.html'))) {
    app.use(express.static(config.frontendDist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.resolve(config.frontendDist, 'index.html')));
  }

  function createSessionId(config) {
    if (!config.anonymousSessionSecret) {
      throw new Error('ANONYMOUS_SESSION_SECRET must be configured in production.');
    }
    const expiresAt = Date.now() + config.anonymousSessionMaxAgeMs;
    const nonce = crypto.randomBytes(24).toString('base64url');
    const expiry = expiresAt.toString(36);
    const unsigned = `${nonce}.${expiry}`;
    const signature = crypto.createHmac('sha256', config.anonymousSessionSecret).update(unsigned).digest('base64url').slice(0, 16);
    return `${unsigned}.${signature}`;
  }

  function parseSessionCookie(value, config) {
    if (!value || !config.anonymousSessionSecret) return null;
    const parts = value.split('.');
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]{32}$/.test(parts[0]) || !/^[a-z0-9]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{16}$/.test(parts[2])) {
      return null;
    }
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', config.anonymousSessionSecret).update(unsigned).digest('base64url').slice(0, 16);
    if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected))) return null;
    const expiresAt = Number.parseInt(parts[1], 36);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
    return value;
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

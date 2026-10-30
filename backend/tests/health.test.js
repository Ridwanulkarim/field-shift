import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

const app = createApp(loadConfig({}));

describe('GET /api/health', () => {
  it('returns 200 and status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('field-shift-backend');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});

describe('unknown routes', () => {
  it('return a JSON 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('loadConfig', () => {
  it('uses port 4000 by default', () => {
    expect(loadConfig({}).port).toBe(4000);
  });
  it('reads PORT from the environment', () => {
    expect(loadConfig({ PORT: '5001' }).port).toBe(5001);
  });
  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/Invalid PORT/);
  });
  it('reads DATABASE_URL and defaults it to empty', () => {
    expect(loadConfig({}).databaseUrl).toBe('');
    expect(loadConfig({ DATABASE_URL: 'postgresql://x' }).databaseUrl).toBe('postgresql://x');
  });
});

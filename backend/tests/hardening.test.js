// Tests for the small safety pieces: bounded caches, the rate limiter, proxy trust and session secrets.
// No database and no NASA data are involved.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { boundedSet } from '../src/utils/boundedCache.js';
import { createRateLimiter } from '../src/utils/rateLimiter.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

describe('boundedSet', () => {
  it('drops the oldest entry once the limit is exceeded', () => {
    const cache = new Map();
    for (const k of ['a', 'b', 'c']) boundedSet(cache, k, k.toUpperCase(), 2);
    expect([...cache.keys()]).toEqual(['b', 'c']);
  });
  it('treats a re-inserted key as the newest', () => {
    const cache = new Map();
    boundedSet(cache, 'a', 1, 2);
    boundedSet(cache, 'b', 2, 2);
    boundedSet(cache, 'a', 3, 2);
    boundedSet(cache, 'c', 4, 2);
    expect([...cache.keys()]).toEqual(['a', 'c']);
    expect(cache.get('a')).toBe(3);
  });
  it('returns the stored value and rejects a nonsense limit', () => {
    expect(boundedSet(new Map(), 'k', 42, 1)).toBe(42);
    expect(() => boundedSet(new Map(), 'k', 1, 0)).toThrow(/positive integer/);
  });
});

describe('createRateLimiter', () => {
  it('allows up to the limit, then refuses with a retry time, then recovers after the window', () => {
    let t = 1_000;
    const limiter = createRateLimiter({ windowMs: 60_000, now: () => t });
    for (let i = 0; i < 3; i += 1) expect(limiter.hit('k', 3).allowed).toBe(true);
    t += 10_000;
    expect(limiter.hit('k', 3)).toEqual({ allowed: false, retryAfterSeconds: 50 });
    t += 50_000; // exactly one window after the first hit
    expect(limiter.hit('k', 3).allowed).toBe(true);
  });
  it('keeps separate counts per key', () => {
    const limiter = createRateLimiter({ now: () => 0 });
    expect(limiter.hit('a', 1).allowed).toBe(true);
    expect(limiter.hit('a', 1).allowed).toBe(false);
    expect(limiter.hit('b', 1).allowed).toBe(true);
  });
  it('sweeps expired windows when the table is full, so memory stays bounded', () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 1000, maxKeys: 3, now: () => t });
    limiter.hit('a', 5); limiter.hit('b', 5); limiter.hit('c', 5);
    expect(limiter.size()).toBe(3);
    t = 5000; // all three windows have expired
    limiter.hit('d', 5);
    expect(limiter.size()).toBe(1);
  });
  it('never exceeds maxKeys even when every window is still live', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxKeys: 3, now: () => 0 });
    for (const k of ['a', 'b', 'c', 'd', 'e']) limiter.hit(k, 5);
    expect(limiter.size()).toBe(3);
  });
});

describe('trust proxy and the rate limit', () => {
  // 61 writes from "one client" exceed the 60 per minute write limit.
  async function exhaust(app, forwardedFor) {
    let last;
    for (let i = 0; i < 61; i += 1) last = await request(app).post('/api/nothing').set('X-Forwarded-For', forwardedFor).send({});
    return last;
  }
  it('ignores X-Forwarded-For by default, so a client cannot dodge the limit by changing it', async () => {
    const app = createApp(loadConfig({}));
    expect((await exhaust(app, '10.0.0.1')).status).toBe(429);
    const other = await request(app).post('/api/nothing').set('X-Forwarded-For', '10.0.0.2').send({});
    expect(other.status).toBe(429);
  });
  it('uses the forwarded address when one proxy hop is trusted', async () => {
    const app = createApp(loadConfig({ TRUST_PROXY: '1' }));
    expect((await exhaust(app, '10.0.0.1')).status).toBe(429);
    const other = await request(app).post('/api/nothing').set('X-Forwarded-For', '10.0.0.2').send({});
    expect(other.status).not.toBe(429);
  });
});

describe('configuration', () => {
  it('parses TRUST_PROXY and rejects nonsense', () => {
    expect(loadConfig({}).trustProxy).toBe(0);
    expect(loadConfig({ TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(() => loadConfig({ TRUST_PROXY: 'yes' })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ TRUST_PROXY: '9' })).toThrow(/TRUST_PROXY/);
  });
  it('no longer uses a hard-coded development session secret', () => {
    const c = loadConfig({});
    expect(c.anonymousSessionSecret).not.toBe('development-only-session-secret');
    expect(c.anonymousSessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(c.sessionSecretIsEphemeral).toBe(true);
    expect(loadConfig({}).anonymousSessionSecret).toBe(c.anonymousSessionSecret); // stable within one process
  });
  it('uses the configured secret when one is set and still requires it in production', () => {
    const secret = 'x'.repeat(40);
    const c = loadConfig({ ANONYMOUS_SESSION_SECRET: secret });
    expect(c.anonymousSessionSecret).toBe(secret);
    expect(c.sessionSecretIsEphemeral).toBe(false);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/ANONYMOUS_SESSION_SECRET/);
  });
});

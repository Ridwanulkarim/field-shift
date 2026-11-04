// Fixed-window, in-memory rate limiter (one process only). Counts requests per key in a window.
// To stop the table from growing forever, expired windows are swept out once the table is large.
//
//   const limiter = createRateLimiter({ windowMs: 60_000, maxKeys: 10_000 });
//   const result = limiter.hit('1.2.3.4:read', 300);   // { allowed, retryAfterSeconds }
export function createRateLimiter({ windowMs = 60_000, maxKeys = 10_000, now = () => Date.now() } = {}) {
  const table = new Map();

  function sweep(t) {
    for (const [key, entry] of table) {
      if (t - entry.startedAt >= windowMs) table.delete(key);
    }
  }

  return {
    hit(key, limit) {
      const t = now();
      const current = table.get(key);
      if (!current || t - current.startedAt >= windowMs) {
        if (!current && table.size >= maxKeys) {
          sweep(t);
          // Still full of live windows: drop the oldest so memory stays bounded.
          if (table.size >= maxKeys) table.delete(table.keys().next().value);
        }
        table.delete(key);
        table.set(key, { startedAt: t, count: 1 });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (t - current.startedAt)) / 1000) };
      }
      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
    size: () => table.size,
  };
}

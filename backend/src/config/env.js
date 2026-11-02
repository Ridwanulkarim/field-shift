// Reads configuration from environment variables and validates it.
// Everything else in the app imports `config` from here instead of
// touching process.env directly, so there is one place to look.

const DEFAULT_PORT = 4000;

function parsePort(raw) {
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${raw}". Use a whole number between 1 and 65535.`);
  }
  return port;
}

function databaseUrls(env, nodeEnv) {
  const suffix = nodeEnv === 'production' ? 'PRODUCTION' : 'DEVELOPMENT';
  return {
    databaseUrl: env[`DATABASE_URL_${suffix}`] || '',
    directUrl: env[`DIRECT_URL_${suffix}`] || '',
  };
}

function parseBoundedInteger(raw, fallback, label, min, max) {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}. Use a whole number between ${min} and ${max}.`);
  }
  return value;
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const { databaseUrl } = databaseUrls(env, nodeEnv);
  const anonymousSessionSecret = env.ANONYMOUS_SESSION_SECRET || (nodeEnv === 'production' ? '' : 'development-only-session-secret');
  if (nodeEnv === 'production' && anonymousSessionSecret.length < 32) {
    throw new Error('ANONYMOUS_SESSION_SECRET must be at least 32 characters in production.');
  }
  return {
    port: parsePort(env.PORT),
    nodeEnv,
    // Browser origin allowed to call this API (the Vite dev server).
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    anonymousSessionSecret,
    anonymousSessionMaxAgeMs: 1000 * 60 * 60 * 24 * 365,
    nasaPowerTimeoutMs: parseBoundedInteger(env.NASA_POWER_TIMEOUT_MS, 120000, 'NASA_POWER_TIMEOUT_MS', 1000, 300000),
    nasaPowerRetries: parseBoundedInteger(env.NASA_POWER_RETRIES, 3, 'NASA_POWER_RETRIES', 0, 5),
    // Neon (or local PostgreSQL) connection string used by the running API. Empty = no database.
    databaseUrl,
    // Optional: folder with the built frontend, served by this same server (demo mode).
    frontendDist: env.FRONTEND_DIST || '',
  };
}

export { databaseUrls };
export const config = loadConfig();

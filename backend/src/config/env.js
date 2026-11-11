// Reads configuration from environment variables and validates it.
// Everything else in the app imports `config` from here instead of
// touching process.env directly, so there is one place to look.

import crypto from 'node:crypto';

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

// Used only when ANONYMOUS_SESSION_SECRET is unset outside production. It is random for each process, so
// no secret is hard-coded in the repository. The cost: browser session cookies stop working after a
// restart (a developer loses ownership of the field they created). Set ANONYMOUS_SESSION_SECRET in .env
// to avoid that. In production the variable is required.
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');

// OFFLINE=1 (also true/yes/on) serves climate from backend/data/offline/*.json only. 0/false/no/off/unset = normal.
function parseBoolean(raw, label) {
  if (raw === undefined || raw === '') return false;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  throw new Error(`Invalid ${label} "${raw}". Use 1 or 0 (also accepted: true/false, yes/no, on/off).`);
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const { databaseUrl } = databaseUrls(env, nodeEnv);
  const anonymousSessionSecret = env.ANONYMOUS_SESSION_SECRET || (nodeEnv === 'production' ? '' : EPHEMERAL_SESSION_SECRET);
  if (nodeEnv === 'production' && anonymousSessionSecret.length < 32) {
    throw new Error('ANONYMOUS_SESSION_SECRET must be at least 32 characters in production.');
  }
  return {
    port: parsePort(env.PORT),
    nodeEnv,
    // Browser origins allowed to call this API (comma-separated; default is the Vite dev server).
    corsOrigins: (env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
    anonymousSessionSecret,
    sessionSecretIsEphemeral: !env.ANONYMOUS_SESSION_SECRET,
    // Number of reverse-proxy hops to trust for req.ip (0 = none). See app.js.
    trustProxy: parseBoundedInteger(env.TRUST_PROXY, 0, 'TRUST_PROXY', 0, 5),
    anonymousSessionMaxAgeMs: 1000 * 60 * 60 * 24 * 365,
    nasaPowerTimeoutMs: parseBoundedInteger(env.NASA_POWER_TIMEOUT_MS, 120000, 'NASA_POWER_TIMEOUT_MS', 1000, 300000),
    nasaPowerRetries: parseBoundedInteger(env.NASA_POWER_RETRIES, 3, 'NASA_POWER_RETRIES', 0, 5),
    // NASA Earthdata token for GPM IMERG (ingestion scripts only; the web API never needs it). Never logged.
    earthdataToken: env.EARTHDATA_TOKEN || '',
    imergConcurrency: parseBoundedInteger(env.IMERG_CONCURRENCY, 4, 'IMERG_CONCURRENCY', 1, 16),
    imergTimeoutMs: parseBoundedInteger(env.IMERG_TIMEOUT_MS, 60000, 'IMERG_TIMEOUT_MS', 1000, 300000),
    // Neon (or local PostgreSQL) connection string used by the running API. Empty = no database.
    databaseUrl,
    // OFFLINE=1: never open the database or the network; read the committed files in offlineDataDir (see docs/OFFLINE.md).
    offline: parseBoolean(env.OFFLINE, 'OFFLINE'),
    // Empty = backend/data/offline (the committed snapshot).
    offlineDataDir: env.OFFLINE_DATA_DIR || '',
    // Optional: folder with the built frontend, served by this same server (demo mode).
    frontendDist: env.FRONTEND_DIST || '',
  };
}

export { databaseUrls };
export const config = loadConfig();

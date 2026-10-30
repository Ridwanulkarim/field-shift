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

export function loadConfig(env = process.env) {
  return {
    port: parsePort(env.PORT),
    nodeEnv: env.NODE_ENV || 'development',
    // Browser origin allowed to call this API (the Vite dev server).
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    // Neon (or local PostgreSQL) connection string used by the running API. Empty = no database.
    databaseUrl: env.DATABASE_URL || '',
    // Optional: folder with the built frontend, served by this same server (demo mode).
    frontendDist: env.FRONTEND_DIST || '',
  };
}

export const config = loadConfig();

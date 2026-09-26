/**
 * Field Shift - Database Connection & Dual-Mode Adapter
 * Connects to live PostgreSQL when DATABASE_URL is set, or initializes
 * an in-memory PostgreSQL engine (pg-mem) for standalone offline testing.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let pool = null;
let memDb = null;
let memAdapter = null;

function initDb() {
  if (config.DATABASE_URL) {
    // Production / Staging / Local Live PostgreSQL
    console.log('[DB] Connecting to live PostgreSQL database...');
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    return {
      query: (text, params) => pool.query(text, params),
      getClient: () => pool.connect(),
      mode: 'postgres',
      pool
    };
  } else {
    // Standalone In-Memory PostgreSQL instance for local development / testing
    if (!memAdapter) {
      console.log('[DB] DATABASE_URL not set. Initializing in-memory PostgreSQL engine (pg-mem)...');
      const { newDb } = require('pg-mem');
      memDb = newDb({
        autoCreateForeignKeyIndices: true
      });

      // Register custom functions if necessary
      memDb.public.registerFunction({
        name: 'current_timestamp',
        returns: memDb.public.getType('timestamp with time zone'),
        implementation: () => new Date()
      });

      memAdapter = memDb.adapters.createPg();
      pool = new memAdapter.Pool();
    }

    return {
      query: (text, params) => pool.query(text, params),
      getClient: () => pool.connect(),
      mode: 'pg-mem',
      memDb,
      pool
    };
  }
}

let currentDb = initDb();

async function resetDb() {
  if (currentDb.mode === 'pg-mem') {
    if (pool) {
      try { pool.end(); } catch (e) {}
    }
    memAdapter = null;
    memDb = null;
    pool = null;
    currentDb = initDb();
  } else {
    // Live PostgreSQL: drop all tables in public schema
    await currentDb.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
}

module.exports = {
  query: (text, params) => currentDb.query(text, params),
  getClient: () => currentDb.getClient(),
  getMode: () => currentDb.mode,
  getPool: () => currentDb.pool,
  getMemDb: () => currentDb.memDb,
  resetDb
};

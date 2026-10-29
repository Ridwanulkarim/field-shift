import { fileURLToPath } from 'node:url';
/**
 * Field Shift - Database Migration Runner
 * Executes the authoritative PostgreSQL DDL schema.
 */
import fs from 'node:fs';
import path from 'node:path';
import db from './index.js';
import schemaSql from './schemaSql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanSql(sql) {
  // Remove multi-line comments
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments
  cleaned = cleaned.replace(/--.*$/gm, '');
  return cleaned;
}

function getSchemaSql() {
  const candidatePaths = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'backend', 'db', 'schema.sql'),
    path.join(process.cwd(), 'db', 'schema.sql')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, 'utf8');
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback to pre-bundled schema string
  return schemaSql;
}

async function runMigration() {
  const rawSql = getSchemaSql();
  const cleanedSql = cleanSql(rawSql);

  console.log(`[Migration] Executing schema in ${db.getMode()} mode...`);
  
  const statements = cleanedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (err) {
      console.error(`[Migration Error] Failed statement: ${statement.slice(0, 100)}...`);
      throw err;
    }
  }

  console.log(`[Migration] Schema successfully migrated! (${statements.length} DDL statements executed)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => {
      console.log('[Migration] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}

export { runMigration, cleanSql };

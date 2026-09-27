/**
 * Field Shift - Database Migration Runner
 * Executes the authoritative PostgreSQL DDL schema.
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');

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
  try {
    return require('./schemaSql');
  } catch (err) {
    throw new Error('Unable to locate schema.sql in: ' + candidatePaths.join(', '));
  }
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

if (require.main === module) {
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

module.exports = { runMigration, cleanSql };

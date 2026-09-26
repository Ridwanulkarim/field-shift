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

async function runMigration() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`[Migration] Reading schema from ${schemaPath}...`);
  const rawSql = fs.readFileSync(schemaPath, 'utf8');
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

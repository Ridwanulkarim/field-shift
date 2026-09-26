/**
 * Field Shift - Server Entrypoint (Spec Section 45)
 */
require('dotenv').config();
const { app, initializeDatabase } = require('./app');

const PORT = process.env.PORT || 5001;

async function startServer() {
  await initializeDatabase();
  const server = app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`FIELD SHIFT REST API SERVER RUNNING ON PORT ${PORT}`);
    console.log(`================================================================`);
    console.log(`  GET  /api/health`);
    console.log(`  GET  /api/crops`);
    console.log(`  GET  /api/fields`);
    console.log(`  GET  /api/fields/:id`);
    console.log(`  POST /api/rotations/evaluate`);
    console.log(`  POST /api/rotations/compare`);
    console.log(`  GET  /api/rotations/field/:fieldId`);
    console.log(`================================================================`);
  });
  return server;
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer };

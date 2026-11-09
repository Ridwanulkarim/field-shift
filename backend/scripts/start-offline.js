// Starts the API in OFFLINE mode on any operating system (no `OFFLINE=1 npm start` shell syntax needed):
//   npm run start:offline
//   npm run start:offline -- --with-frontend      also serves ../frontend/dist (build it first: cd frontend && npm run build)
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

process.env.OFFLINE = '1';
if (process.argv.includes('--with-frontend') && !process.env.FRONTEND_DIST) {
  const dist = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
  if (!fs.existsSync(`${dist}/index.html`)) {
    console.error(`No built frontend at ${dist}. Run: cd ../frontend && npm install && npm run build`);
    process.exit(1);
  }
  process.env.FRONTEND_DIST = dist;
}
await import('../src/server.js');

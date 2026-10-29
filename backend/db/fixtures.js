/**
 * Field Shift - Pre-computed Authoritative Demo Fixtures Loader
 * Ensures zero-cold-start overhead on Vercel Serverless Functions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let fixtures = null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));
} catch (e) {
  const candidatePaths = [
    path.join(__dirname, 'fixtures.json'),
    path.join(process.cwd(), 'backend', 'db', 'fixtures.json'),
    path.join(process.cwd(), 'db', 'fixtures.json')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        fixtures = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch (err) {}
  }
}

export default fixtures;

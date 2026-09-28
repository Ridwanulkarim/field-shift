/**
 * Field Shift - Pre-computed Authoritative Demo Fixtures Loader
 * Ensures zero-cold-start overhead on Vercel Serverless Functions.
 */
const fs = require('fs');
const path = require('path');

let fixtures = null;

try {
  fixtures = require('./fixtures.json');
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

module.exports = fixtures;

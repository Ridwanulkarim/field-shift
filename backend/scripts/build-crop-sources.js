// Turns the reviewed crop sheet into src/data/reference/cropSources.json (the verified-values overlay).
//
//   npm run build:crop-sources                      DRY RUN: shows what would be written, changes nothing
//   npm run build:crop-sources -- --write           writes the overlay (refuses if any sheet row is rejected)
//   npm run build:crop-sources -- path/to/sheet.csv [--write]
//
// Review the resulting git diff of cropSources.json like any other change: it is the list of numbers the app will call verified.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';
import { BASE_CROPS } from '../src/data/reference/crops.js';
import { validateCropSheet } from '../src/science/cropSheet.js';
import { buildOverlay } from '../src/science/cropSources.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { write: { type: 'boolean' } } });
const sheetPath = positionals[0] ?? join(import.meta.dirname, '../../docs/templates/crop-traits-sourcing.csv');
const outPath = join(import.meta.dirname, '../src/data/reference/cropSources.json');

const result = validateCropSheet(readFileSync(sheetPath, 'utf8'), { crops: BASE_CROPS });
if (!result.ok) {
  for (const e of result.errors) console.error(`ERROR ${e.line ? `line ${e.line}` : 'sheet'}${e.crop ? ` ${e.crop}/${e.trait}` : ''}: ${e.message}`);
  console.error('Not writing anything: fix the rejected rows first (npm run check:crops shows them).');
  process.exit(1);
}
const overlay = buildOverlay(result.approved, { sheetName: basename(sheetPath) });
console.log(`${overlay.approved.length} verified value(s) from ${sheetPath}`);
for (const a of overlay.approved) console.log(`  ${a.slug}/${a.trait} = ${a.value}  (${a.citation.organisation}, ${a.citation.pageOrTable}; reviewed by ${a.citation.reviewer})`);
if (!values.write) {
  console.log('Dry run: nothing written. Add --write to update cropSources.json.');
} else {
  writeFileSync(outPath, `${JSON.stringify(overlay, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}

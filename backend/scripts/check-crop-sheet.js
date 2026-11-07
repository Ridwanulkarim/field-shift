// Checks the filled-in crop-trait sourcing sheet and reports what may be treated as verified. READ-ONLY: it never edits
// crops.js or the sheet. Run it whenever teammates update the sheet.
//
//   npm run check:crops                        checks docs/templates/crop-traits-sourcing.csv
//   npm run check:crops -- path/to/sheet.csv   checks another file (for example an export of the shared spreadsheet)
//   npm run check:crops -- --list-approved     also prints every value that passed all the rules, with its citation
//
// Exit code 1 if any row is rejected, 0 otherwise. Warnings never fail the run.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BASE_CROPS as CROPS } from '../src/data/reference/crops.js';
import { validateCropSheet } from '../src/science/cropSheet.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'list-approved': { type: 'boolean' } } });
const path = positionals[0] ?? join(import.meta.dirname, '../../docs/templates/crop-traits-sourcing.csv');

let text;
try {
  text = readFileSync(path, 'utf8');
} catch (err) {
  console.error(`Cannot read ${path}: ${err.message}`);
  process.exit(1);
}
const result = validateCropSheet(text, { crops: CROPS });

console.log(`Sheet: ${path}`);
if (result.summary) {
  const s = result.summary;
  console.log(`${s.rows} rows | verified ${s.byStatus.verified} | unverified ${s.byStatus.unverified} | disputed ${s.byStatus.disputed} | no_source_found ${s.byStatus.no_source_found}`);
  console.log(`${s.approvedCount} value(s) passed every rule; ${s.rejectedCount} row(s) rejected.`);
  const touched = s.crops.filter((c) => c.verified > 0);
  if (touched.length) {
    console.log('Verified traits per crop:');
    for (const c of touched) console.log(`  ${c.slug}: ${c.verified} of ${c.traits}`);
  }
}
for (const e of result.errors) console.log(`ERROR   ${e.line ? `line ${e.line}` : 'sheet'}${e.crop ? ` ${e.crop}/${e.trait}` : ''}: ${e.message}`);
const shown = result.warnings.slice(0, 20);
for (const w of shown) console.log(`warning ${w.line ? `line ${w.line}` : 'sheet'}${w.crop ? ` ${w.crop}/${w.trait}` : ''}: ${w.message}`);
if (result.warnings.length > shown.length) console.log(`... and ${result.warnings.length - shown.length} more warning(s).`);
if (values['list-approved']) {
  for (const a of result.approved) console.log(`APPROVED ${a.slug}/${a.trait} = ${a.value} (was ${a.replaces}) | ${a.citation.organisation}, ${a.citation.title}, ${a.citation.yearOrEdition}, ${a.citation.pageOrTable} | reviewed by ${a.citation.reviewer} on ${a.citation.reviewDate}`);
}
console.log(result.ok ? 'Result: OK (no rejected rows).' : 'Result: PROBLEMS FOUND. Fix the rows above and run again.');
process.exitCode = result.ok ? 0 : 1;

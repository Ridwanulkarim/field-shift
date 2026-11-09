// Writes the sheet a native Bangla speaker reviews: docs/templates/bangla-review.csv.
// No database or network needed: the sentences are produced by the real code on labelled FIXTURE data.
//   npm run export:bangla
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBanglaReviewRows, toCsv } from '../src/services/banglaReview.js';

const rows = await buildBanglaReviewRows();
const out = join(import.meta.dirname, '../../docs/templates/bangla-review.csv');
writeFileSync(out, toCsv(rows));
const byGroup = rows.reduce((a, r) => ({ ...a, [r.group]: (a[r.group] ?? 0) + 1 }), {});
console.log(`Wrote ${rows.length} rows to ${out}`);
console.log(Object.entries(byGroup).map(([g, n]) => `  ${g}: ${n}`).join('\n'));
console.log('Give this file to a native Bangla speaker. See docs/BANGLA_REVIEW.md.');

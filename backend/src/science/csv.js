// Minimal RFC 4180 CSV reader: quoted fields, "" as an escaped quote, commas and line breaks inside quotes, CRLF or LF.
// Returns an array of rows (arrays of strings). Throws on an unterminated quote. No dependency needed for this.
export function parse(text) {
  if (typeof text !== 'string') throw new Error('CSV text must be a string.');
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = ''; i += 1; continue;
    }
    field += ch; i += 1;
  }
  if (inQuotes) throw new Error('A quoted field is never closed.');
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

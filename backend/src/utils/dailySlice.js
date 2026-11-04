// Cuts a stored daily series to the requested date range. A day the series does not contain is reported as
// null (missing), never as zero and never guessed. Also counts the missing values per variable.
export function sliceDaily(series, from, to) {
  const byDate = new Map(series.map((row) => [row.date, row]));
  const daily = [];
  const missing = { precipMm: 0, tMaxC: 0, tMinC: 0 };
  for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const row = byDate.get(date);
    const day = { date, precipMm: row?.precipMm ?? null, tMaxC: row?.tMaxC ?? null, tMinC: row?.tMinC ?? null };
    for (const key of Object.keys(missing)) if (day[key] === null) missing[key] += 1;
    daily.push(day);
  }
  return { daily, missing };
}

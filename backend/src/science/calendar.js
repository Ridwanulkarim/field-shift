// Calendar helpers for crop windows that can wrap past December (e.g. Boro: Dec -> May).

export function monthsBetween(startMonth, endMonth) {
  const out = [];
  let m = startMonth;
  for (let i = 0; i < 12; i += 1) {
    out.push(m);
    if (m === endMonth) return out;
    m = m === 12 ? 1 : m + 1;
  }
  throw new Error(`Invalid month window ${startMonth}-${endMonth}`);
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isWrapping(startMonth, endMonth) {
  return startMonth > endMonth;
}

// A date in (year, month) belongs to the cycle that STARTED in `cycleYear`.
// Boro (12 -> 5): January 2010 belongs to the cycle that started in December 2009.
// Returns null when the month is outside the window.
export function cycleYearOf(year, month, startMonth, endMonth) {
  const months = monthsBetween(startMonth, endMonth);
  if (!months.includes(month)) return null;
  if (isWrapping(startMonth, endMonth) && month <= endMonth) return year - 1;
  return year;
}

// Number of calendar days in the whole window for the cycle starting in `cycleYear`.
export function expectedDaysInCycle(cycleYear, startMonth, endMonth) {
  const wrap = isWrapping(startMonth, endMonth);
  return monthsBetween(startMonth, endMonth).reduce((sum, m) => {
    const y = wrap && m <= endMonth ? cycleYear + 1 : cycleYear;
    return sum + daysInMonth(y, m);
  }, 0);
}

export function overlapMonths(monthsA, monthsB) {
  const b = new Set(monthsB);
  return monthsA.filter((m) => b.has(m));
}

export function dayOfYear(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

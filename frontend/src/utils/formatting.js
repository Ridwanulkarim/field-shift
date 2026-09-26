/**
 * Field Shift - Formatting and Agricultural Utilities (Spec Section 25, 52-54)
 */

export function formatDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 'Dec 30, 2023 – Feb 28, 2024 (61 days)';
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  const sFormatted = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const eFormatted = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  
  // Compute day count
  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return `${sFormatted} – ${eFormatted} (${diffDays} days)`;
}

export function getConditionBadge(label) {
  switch (label) {
    case 'Healthy relative condition':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: '✓',
        color: '#10b981'
      };
    case 'Watch closely':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        icon: '⚠',
        color: '#f59e0b'
      };
    case 'Moderate stress':
      return {
        bg: 'bg-orange-500/15',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        icon: '⚠',
        color: '#f97316'
      };
    case 'High stress':
    default:
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        icon: '⚠',
        color: '#f43f5e'
      };
  }
}

export function formatScore(score) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';
  return Number(score).toFixed(1);
}

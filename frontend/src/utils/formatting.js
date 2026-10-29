import { toBnDigits } from './i18n';

const BN_MONTHS = {
  Jan: 'জানু', Feb: 'ফেব', Mar: 'মার্চ', Apr: 'এপ্রিল', May: 'মে', Jun: 'জুন',
  Jul: 'জুলাই', Aug: 'আগস্ট', Sep: 'সেপ্টে', Oct: 'অক্টো', Nov: 'নভে', Dec: 'ডিসে'
};

export function formatDateRange(startDateStr, endDateStr, lang = 'en') {
  if (!startDateStr || !endDateStr) {
    return lang === 'bn' ? '৩০ ডিসে, ২০২৩ – ২৮ ফেব, ২০২৪ (৬১ দিন)' : 'Dec 30, 2023 – Feb 28, 2024 (61 days)';
  }
  const s = new Date(startDateStr);
  const e = new Date(endDateStr);
  const sMonth = s.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const sDay = s.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
  const sYear = s.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });

  const eMonth = e.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const eDay = e.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
  const eYear = e.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });

  const diffTime = Math.abs(e.getTime() - s.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (lang === 'bn') {
    const sBn = `${toBnDigits(sDay, 'bn')} ${BN_MONTHS[sMonth] || sMonth}, ${toBnDigits(sYear, 'bn')}`;
    const eBn = `${toBnDigits(eDay, 'bn')} ${BN_MONTHS[eMonth] || eMonth}, ${toBnDigits(eYear, 'bn')}`;
    return `${sBn} – ${eBn} (${toBnDigits(diffDays, 'bn')} দিন)`;
  }

  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear} (${diffDays} days)`;
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

export function formatScore(score, lang = 'en') {
  if (score === null || score === undefined || isNaN(score)) return lang === 'bn' ? 'অপ্রাপ্য' : 'N/A';
  const val = Number(score).toFixed(1);
  return lang === 'bn' ? toBnDigits(val, 'bn') : val;
}

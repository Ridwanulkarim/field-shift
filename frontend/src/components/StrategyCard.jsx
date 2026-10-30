import { monthRange } from '../i18n.js';

const BASIS_TEXT = {
  UNVERIFIED_GENERAL_KNOWLEDGE: 'Unverified assumption (needs expert review)',
};

function List({ title, items, tone }) {
  if (!items?.length) return null;
  const color = tone === 'risk' ? 'text-amber-900' : 'text-gray-800';
  return (
    <div className="mt-4">
      <h4 className="font-semibold">{title}</h4>
      <ul className={`mt-1 list-disc space-y-1 pl-5 text-sm ${color}`}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

function ComponentBar({ c, t }) {
  const pct = c.value === null ? 0 : Math.round(c.value * 100);
  return (
    <li className="text-sm">
      <div className="flex justify-between gap-2">
        <span>{c.label}</span>
        <span className="tabular-nums text-gray-700">
          {c.value === null ? t('notScored') : `${pct}%`} <span className="text-gray-500">(×{c.weight})</span>
        </span>
      </div>
      <div className="mt-1 h-2 rounded bg-gray-200" role="presentation">
        <div className="h-2 rounded bg-green-700" style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

export default function StrategyCard({ strategy: s, lang, t }) {
  const isExisting = s.kind === 'existing';
  const label = lang === 'bn' ? s.labelBn : s.label;
  const cmp = s.comparison;

  return (
    <article
      className={`rounded-xl border p-4 sm:p-5 ${isExisting ? 'border-gray-400 bg-gray-50' : 'border-green-300 bg-white'}`}
      aria-label={label}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {isExisting ? t('yourRotation') : `${t('option')} ${s.rank}`}
          </p>
          <h3 className="mt-1 text-xl font-bold text-green-900">{label}</h3>
        </div>
        <div className="text-right" title={t('scoreHelp')}>
          <p className="text-3xl font-bold tabular-nums text-green-800">{s.score ?? '–'}</p>
          <p className="text-xs text-gray-600">{t('score')}</p>
        </div>
      </header>

      <p className="mt-3 text-sm text-gray-800">{s.summary}</p>

      {cmp && <List title={t('whyBetter')} items={cmp.improvements} />}
      {cmp && <List title={t('tradeOffs')} items={cmp.tradeOffs} tone="risk" />}
      <List title={t('benefits')} items={s.benefits} />
      <List title={t('risks')} items={s.risks} tone="risk" />

      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">{t('components')}</summary>
        <ul className="mt-2 space-y-3">
          {s.components.map((c) => <ComponentBar key={c.id} c={c} t={t} />)}
        </ul>
      </details>

      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">{t('evidence')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-gray-600">
              <tr>
                <th className="py-1 pr-3">{t('crop')}</th>
                <th className="py-1 pr-3">{t('months')}</th>
                <th className="py-1 pr-3">{t('assumedNeed')}</th>
                <th className="py-1 pr-3">{t('meanRain')}</th>
                <th className="py-1 pr-3">{t('heatShare')}</th>
                <th className="py-1">{t('basis')}</th>
              </tr>
            </thead>
            <tbody>
              {s.evidence.map((e) => (
                <tr key={e.crop} className="border-t border-gray-200 align-top">
                  <td className="py-1 pr-3 font-medium">{lang === 'bn' ? e.cropBn : e.crop}</td>
                  <td className="py-1 pr-3">{monthRange(e.months, lang)}</td>
                  <td className="py-1 pr-3">{e.assumedWaterNeedMm.join('–')}</td>
                  <td className="py-1 pr-3">{e.meanRainDuringCropMm ?? '–'}</td>
                  <td className="py-1 pr-3">{e.shareOfDaysAtOrAboveThreshold === null ? '–' : `${Math.round(e.shareOfDaysAtOrAboveThreshold * 100)}% (≥ ${e.heatThresholdC} °C)`}</td>
                  <td className="py-1">{BASIS_TEXT[e.cropParameterBasis] ?? e.cropParameterBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">{t('gaps')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800">
          {s.informationGaps.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </details>
    </article>
  );
}

import Sparkline from './Sparkline.jsx';

function trendText(trend, unit) {
  if (!trend || trend.verdict === 'insufficient_data') return 'Too few years for a trend statement.';
  const slope = `${trend.slopePerDecade > 0 ? '+' : ''}${trend.slopePerDecade} ${unit} per decade`;
  return trend.verdict === 'distinguishable_from_noise'
    ? `Fitted trend ${slope}; larger than year-to-year variation in this series (indicative only, not proof of climate change).`
    : `Fitted trend ${slope}; not distinguishable from year-to-year variation.`;
}

// Shows where the climate numbers come from and how the yearly indicators moved.
export default function ClimatePanel({ climate, t }) {
  if (!climate || climate.status !== 'available') return null;
  const p = climate.provenance;
  return (
    <section className="mt-8" aria-labelledby="climate-h">
      <h2 id="climate-h" className="text-xl font-bold text-green-900">{t('climateEvidence')}</h2>

      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-gray-300 bg-white p-4 text-sm sm:grid-cols-2">
        <div><dt className="inline font-semibold">{t('source')}: </dt><dd className="inline">{p.source}{p.product ? ` (${p.product})` : ''}</dd></div>
        <div><dt className="inline font-semibold">{t('retrieved')}: </dt><dd className="inline">{new Date(p.retrievedAt).toISOString().slice(0, 10)}</dd></div>
        <div><dt className="inline font-semibold">{t('period')}: </dt><dd className="inline">{p.startDate} to {p.endDate}</dd></div>
        <div><dt className="inline font-semibold">{t('rows')}: </dt><dd className="inline">{p.rowCount} ({p.missingCount} missing)</dd></div>
        <div className="sm:col-span-2 text-gray-700">{p.resolutionNote}</div>
      </dl>

      <ul className="mt-4 space-y-3">
        {climate.indicators.map((ind) => (
          <li key={ind.id} className="rounded-lg border border-gray-300 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{ind.label} <span className="font-normal text-gray-600">({ind.unit})</span></h3>
                <p className="text-sm text-gray-600">{ind.definition}</p>
              </div>
              <div className="text-green-800"><Sparkline points={ind.yearly} label={ind.label} /></div>
            </div>
            {ind.trend?.earlyMean != null && (
              <p className="mt-2 text-sm">
                {t('early')}: <strong>{ind.trend.earlyMean}</strong> → {t('recent')}: <strong>{ind.trend.recentMean}</strong> {ind.unit}
                <span className="text-gray-600"> ({ind.trend.windowYears}-year averages)</span>
              </p>
            )}
            <p className="mt-1 text-sm text-gray-700">{trendText(ind.trend, ind.unit)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

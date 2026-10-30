import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { makeT } from './i18n.js';
import EvaluateForm from './components/EvaluateForm.jsx';
import StrategyCard from './components/StrategyCard.jsx';
import ClimatePanel from './components/ClimatePanel.jsx';

function Notice({ tone, children }) {
  const styles = tone === 'warn' ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-red-400 bg-red-50 text-red-900';
  return <div role={tone === 'warn' ? 'status' : 'alert'} className={`mt-4 rounded-lg border p-3 text-sm ${styles}`}>{children}</div>;
}

export default function App() {
  const [lang, setLang] = useState('en');
  const t = useMemo(() => makeT(lang), [lang]);

  const [setup, setSetup] = useState({ state: 'loading' });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadSetup = useCallback(async () => {
    setSetup({ state: 'loading' });
    try {
      const [meta, d, c] = await Promise.all([api.meta(), api.districts(), api.crops()]);
      setSetup({ state: 'ready', meta, districts: d.districts, crops: c.crops });
      setForm((prev) =>
        prev ?? {
          district: (d.districts.find((x) => x.slug === 'rajshahi') ?? d.districts[0])?.slug ?? '',
          existingRotation: ['boro', 'aman'].filter((s) => c.crops.some((x) => x.slug === s)),
          soil: { salinity: 'none', drainage: 'good' },
          irrigation: 'limited',
          priorities: Object.fromEntries(meta.priorities.map((p) => [p.key, meta.priorityRange.default])),
        },
      );
    } catch (err) {
      setSetup({ state: 'error', message: err.message });
    }
  }, []);

  useEffect(() => {
    loadSetup();
  }, [loadSetup]);

  async function evaluate() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.evaluate(form));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-green-900 bg-green-800 text-white">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-4 px-4 py-5">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{t('appName')}</h1>
            <p className="mt-1 text-sm text-green-50 sm:text-base">{t('tagline')}</p>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="shrink-0 rounded-md border border-white px-3 py-1 text-sm font-semibold hover:bg-green-700"
            lang={lang === 'en' ? 'bn' : 'en'}
          >
            {t('language')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6" lang={lang}>
        {setup.state === 'loading' && <p role="status">{t('loadingSetup')}</p>}

        {setup.state === 'error' && (
          <Notice tone="error">
            <p className="font-semibold">{t('setupFailed')}</p>
            <p className="mt-1">{setup.message}</p>
            <button type="button" onClick={loadSetup} className="mt-2 rounded border border-red-700 px-3 py-1 font-semibold">{t('retry')}</button>
          </Notice>
        )}

        {setup.state === 'ready' && form && (
          <>
            <EvaluateForm
              meta={setup.meta}
              districts={setup.districts}
              crops={setup.crops}
              form={form}
              setForm={setForm}
              onSubmit={evaluate}
              busy={busy}
              t={t}
              lang={lang}
            />

            {lang === 'bn' && <p className="mt-3 text-sm text-gray-700">{t('englishOnly')}</p>}

            {error && (
              <Notice tone="error">
                <p className="font-semibold">{error.message}</p>
                {error.details?.map((d, i) => <p key={i}>{d.field}: {d.message}</p>)}
              </Notice>
            )}

            {result && (
              <section className="mt-8" aria-labelledby="results-h">
                <h2 id="results-h" className="text-xl font-bold text-green-900">{t('results')}</h2>
                {result.climate.notice && <Notice tone="warn"><strong>{result.climate.notice}</strong></Notice>}
                <p className="mt-2 text-sm text-gray-700">
                  {result.alternativesConsidered} {t('alternativesConsidered')}.
                </p>
                <div className="mt-4 space-y-5">
                  {result.strategies.map((s) => <StrategyCard key={s.id + s.kind} strategy={s} lang={lang} t={t} />)}
                </div>

                <ClimatePanel climate={result.climate} t={t} />

                <section className="mt-8 rounded-lg border border-gray-300 bg-white p-4 text-sm" aria-labelledby="method-h">
                  <h2 id="method-h" className="text-lg font-bold text-green-900">{t('howWeScore')}</h2>
                  <p className="mt-1">{result.method.summary}</p>
                  <h3 className="mt-3 font-semibold">{t('limitations')}</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </section>

                <p className="mt-6 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-950">{result.disclaimer}</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

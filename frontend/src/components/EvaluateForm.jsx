const selectClass = 'mt-1 w-full rounded-md border border-gray-400 bg-white p-2';

function dataBadge(kind, t) {
  if (kind === 'nasa') return t('nasa');
  if (kind === 'synthetic') return t('synthetic');
  return t('noClimate');
}

export default function EvaluateForm({ meta, districts, crops, form, setForm, onSubmit, busy, t, lang }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function toggleCrop(slug) {
    const has = form.existingRotation.includes(slug);
    set({ existingRotation: has ? form.existingRotation.filter((s) => s !== slug) : [...form.existingRotation, slug] });
  }

  const tooMany = form.existingRotation.length > 3;
  const none = form.existingRotation.length === 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-6 rounded-xl border border-gray-300 bg-white p-4 sm:p-6"
    >
      <div>
        <label htmlFor="district" className="font-semibold">{t('district')}</label>
        <select id="district" className={selectClass} value={form.district} onChange={(e) => set({ district: e.target.value })}>
          {districts.map((d) => (
            <option key={d.slug} value={d.slug}>
              {lang === 'bn' ? d.nameBn : d.nameEn} ({d.division}) – {dataBadge(d.climateData, t)}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-semibold">{t('currentRotation')}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {crops.map((c) => (
            <label key={c.slug} className="flex items-center gap-2 rounded-md border border-gray-300 p-2">
              <input type="checkbox" className="h-4 w-4" checked={form.existingRotation.includes(c.slug)} onChange={() => toggleCrop(c.slug)} />
              <span>{lang === 'bn' ? c.nameBn : c.nameEn}</span>
            </label>
          ))}
        </div>
        {(tooMany || none) && <p role="alert" className="mt-2 text-sm text-red-700">{tooMany ? t('maxCrops') : t('fallback')}</p>}
      </fieldset>

      <fieldset>
        <legend className="font-semibold">{t('soil')}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="salinity" className="text-sm">{t('salinity')}</label>
            <select id="salinity" className={selectClass} value={form.soil.salinity} onChange={(e) => set({ soil: { ...form.soil, salinity: e.target.value } })}>
              {meta.options.salinity.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="drainage" className="text-sm">{t('drainage')}</label>
            <select id="drainage" className={selectClass} value={form.soil.drainage} onChange={(e) => set({ soil: { ...form.soil, drainage: e.target.value } })}>
              {meta.options.drainage.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="irrigation" className="text-sm">{t('irrigation')}</label>
            <select id="irrigation" className={selectClass} value={form.irrigation} onChange={(e) => set({ irrigation: e.target.value })}>
              {meta.options.irrigation.map((o) => <option key={o} value={o}>{t(o)}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold">{t('priorities')}</legend>
        <div className="mt-2 space-y-3">
          {meta.priorities.map((p) => (
            <div key={p.key}>
              <label htmlFor={`p-${p.key}`} className="flex justify-between text-sm">
                <span>{lang === 'bn' ? p.labelBn : p.labelEn}</span>
                <span className="font-semibold tabular-nums">{form.priorities[p.key]}</span>
              </label>
              <input
                id={`p-${p.key}`}
                type="range"
                className="w-full accent-green-700"
                min={meta.priorityRange.min}
                max={meta.priorityRange.max}
                step={1}
                value={form.priorities[p.key]}
                onChange={(e) => set({ priorities: { ...form.priorities, [p.key]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={busy || none || tooMany || !form.district}
        className="w-full rounded-lg bg-green-800 px-4 py-3 font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {busy ? t('evaluating') : t('evaluate')}
      </button>
    </form>
  );
}

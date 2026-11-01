import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const MAP = { minLon: 88, maxLon: 93, minLat: 20, maxLat: 27 };
const WIDTH = 720;
const HEIGHT = 420;

function toPoint([longitude, latitude]) {
  return {
    x: ((longitude - MAP.minLon) / (MAP.maxLon - MAP.minLon)) * WIDTH,
    y: ((MAP.maxLat - latitude) / (MAP.maxLat - MAP.minLat)) * HEIGHT,
  };
}

function toCoordinate(x, y) {
  return [
    Number((MAP.minLon + (x / WIDTH) * (MAP.maxLon - MAP.minLon)).toFixed(6)),
    Number((MAP.maxLat - (y / HEIGHT) * (MAP.maxLat - MAP.minLat)).toFixed(6)),
  ];
}

function outerRing(field) {
  return field?.boundary?.coordinates?.[0]?.[0] ?? [];
}

function pointsForRing(ring) {
  return ring.map((coordinate) => {
    const point = toPoint(coordinate);
    return `${point.x},${point.y}`;
  }).join(' ');
}

function formatArea(area) {
  return typeof area === 'number' ? `${area.toFixed(2)} ha` : 'Area pending';
}

function FieldMap({ districts, fields, draft, setDraft, selectedId, setSelectedId, editing }) {
  const [dragging, setDragging] = useState(null);
  const districtPoints = districts
    .map((district) => ({ ...district, point: toPoint([district.longitude, district.latitude]) }))
    .filter(({ point }) => point.x >= 0 && point.x <= WIDTH && point.y >= 0 && point.y <= HEIGHT);

  function clickMap(event) {
    if (!editing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toCoordinate(
      ((event.clientX - rect.left) / rect.width) * WIDTH,
      ((event.clientY - rect.top) / rect.height) * HEIGHT,
    );
    setDraft((current) => [...current, point]);
  }

  function moveVertex(event, index) {
    if (!dragging || !editing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = toCoordinate(
      ((event.clientX - rect.left) / rect.width) * WIDTH,
      ((event.clientY - rect.top) / rect.height) * HEIGHT,
    );
    setDraft((current) => current.map((coordinate, i) => (i === index ? point : coordinate)));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-green-200 bg-sky-50">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="application"
        aria-label="Interactive field boundary map"
        className="block h-auto w-full cursor-crosshair"
        onClick={clickMap}
        onPointerMove={moveVertex}
        onPointerUp={() => setDragging(null)}
      >
        <rect width={WIDTH} height={HEIGHT} fill="#e0f2fe" />
        {[0, 1, 2, 3, 4].map((line) => {
          const x = (line / 4) * WIDTH;
          return <line key={`v-${line}`} x1={x} y1="0" x2={x} y2={HEIGHT} stroke="#bae6fd" />;
        })}
        {[0, 1, 2, 3].map((line) => {
          const y = (line / 3) * HEIGHT;
          return <line key={`h-${line}`} x1="0" y1={y} x2={WIDTH} y2={y} stroke="#bae6fd" />;
        })}
        <path d="M70 30 L250 18 L430 75 L575 45 L690 160 L650 320 L480 390 L280 365 L120 300 Z" fill="#dcfce7" stroke="#86efac" strokeWidth="2" />
        {districtPoints.map((district) => (
          <g key={district.id}>
            <circle cx={district.point.x} cy={district.point.y} r="5" fill="#166534" />
            <text x={district.point.x + 8} y={district.point.y - 7} fontSize="12" fill="#14532d">{district.nameEn}</text>
          </g>
        ))}
        {fields.map((field) => {
          const ring = outerRing(field);
          if (ring.length < 3) return null;
          const selected = field.id === selectedId;
          return (
            <polygon
              key={field.id}
              points={pointsForRing(ring)}
              fill={selected ? '#fbbf24' : '#22c55e'}
              fillOpacity={selected ? '0.5' : '0.28'}
              stroke={selected ? '#92400e' : '#166534'}
              strokeWidth={selected ? '3' : '2'}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(field.id);
              }}
            />
          );
        })}
        {draft.length >= 2 && <polyline points={pointsForRing([...draft, draft[0]])} fill="none" stroke="#b45309" strokeWidth="3" strokeDasharray="7 5" />}
        {draft.map((coordinate, index) => {
          const point = toPoint(coordinate);
          return (
            <circle
              key={`${index}-${coordinate.join('-')}`}
              cx={point.x}
              cy={point.y}
              r="7"
              fill="#b45309"
              stroke="white"
              strokeWidth="2"
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragging(index);
              }}
            />
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-200 bg-white px-3 py-2 text-xs text-gray-700">
        <span>Map area: 88–93°E, 20–27°N</span>
        <span>Click to add points; drag orange points to edit.</span>
      </div>
    </div>
  );
}

export default function FieldManager({ districts, t }) {
  const [fields, setFields] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [query, setQuery] = useState('');
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? '');
  const [form, setForm] = useState({ name: '', soilType: '', soilPh: '', organicMatterPct: '', salinityDsM: '', irrigationSource: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const filteredFields = useMemo(() => {
    const text = query.trim().toLowerCase();
    return fields.filter((field) => !text || field.name.toLowerCase().includes(text) || field.district?.nameEn.toLowerCase().includes(text));
  }, [fields, query]);
  const selected = fields.find((field) => field.id === selectedId) ?? null;

  async function loadFields() {
    setBusy(true);
    try {
      const response = await api.fields();
      setFields(response.fields);
      setLoaded(true);
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadFields();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    if (draft.length < 3) {
      setMessage({ tone: 'error', text: 'Draw at least three boundary points on the map.' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        districtId: Number(districtId),
        boundary: { type: 'Polygon', coordinates: [[...draft, draft[0]]] },
        soilType: form.soilType || null,
        soilPh: form.soilPh === '' ? null : Number(form.soilPh),
        organicMatterPct: form.organicMatterPct === '' ? null : Number(form.organicMatterPct),
        salinityDsM: form.salinityDsM === '' ? null : Number(form.salinityDsM),
        irrigationSource: form.irrigationSource || null,
      };
      const response = selected && editing ? await api.updateField(selected.id, payload) : await api.createField(payload);
      setFields((current) => selected && editing
        ? current.map((field) => (field.id === response.field.id ? response.field : field))
        : [response.field, ...current]);
      setSelectedId(response.field.id);
      setEditing(false);
      setDraft(outerRing(response.field).slice(0, -1));
      setMessage({ tone: 'success', text: selected && editing ? 'Field updated.' : 'Field registered.' });
      setForm({ name: '', soilType: '', soilPh: '', organicMatterPct: '', salinityDsM: '', irrigationSource: '' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  function startCreate() {
    setSelectedId(null);
    setEditing(true);
    setDraft([]);
    setForm({ name: '', soilType: '', soilPh: '', organicMatterPct: '', salinityDsM: '', irrigationSource: '' });
  }

  function startEdit(field) {
    setSelectedId(field.id);
    setEditing(true);
    setDistrictId(field.districtId);
    setDraft(outerRing(field).slice(0, -1));
    setForm({
      name: field.name,
      soilType: field.soilType ?? '',
      soilPh: field.soilPh ?? '',
      organicMatterPct: field.organicMatterPct ?? '',
      salinityDsM: field.salinityDsM ?? '',
      irrigationSource: field.irrigationSource ?? '',
    });
  }

  async function remove(field) {
    if (!window.confirm(`Delete "${field.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteField(field.id);
      setFields((current) => current.filter((item) => item.id !== field.id));
      if (selectedId === field.id) {
        setSelectedId(null);
        setDraft([]);
      }
      setMessage({ tone: 'success', text: 'Field deleted.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-green-200 bg-white p-4 shadow-sm" aria-labelledby="fields-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="fields-heading" className="text-xl font-bold text-green-900">{t('fieldsTitle')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('fieldsDescription')}</p>
        </div>
        <div className="flex gap-2">
          {!loaded && <button type="button" onClick={loadFields} disabled={busy} className="rounded-md border border-green-700 px-3 py-2 text-sm font-semibold text-green-800">{t('loadFields')}</button>}
          <button type="button" onClick={startCreate} className="rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">{t('newField')}</button>
        </div>
      </div>

      {message && <div role={message.tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-md border p-3 text-sm ${message.tone === 'error' ? 'border-red-300 bg-red-50 text-red-900' : 'border-green-300 bg-green-50 text-green-900'}`}>{message.text}</div>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <FieldMap districts={districts} fields={fields} draft={draft} setDraft={setDraft} selectedId={selectedId} setSelectedId={setSelectedId} editing={editing} />
          {editing && <p className="mt-2 text-sm text-gray-600">Draw or edit the boundary above. At least three points are required.</p>}
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-lg bg-gray-50 p-4">
          <h3 className="font-bold text-green-900">{selected && editing ? t('editField') : t('registerField')}</h3>
          <label className="block text-sm font-semibold">{t('fieldName')}<input required maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded border border-gray-300 p-2 font-normal" /></label>
          <label className="block text-sm font-semibold">{t('district')}<select required value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="mt-1 w-full rounded border border-gray-300 p-2 font-normal">{districts.map((district) => <option key={district.id} value={district.id}>{district.nameEn} — {district.nameBn}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['soilType', 'soilType', 'text'],
              ['soilPh', 'soilPh', 'number'],
              ['organicMatterPct', 'organicMatter', 'number'],
              ['salinityDsM', 'fieldSalinity', 'number'],
            ].map(([key, label, type]) => <label key={key} className="text-sm font-semibold">{t(label)}<input type={type} step="any" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded border border-gray-300 p-2 font-normal" /></label>)}
          </div>
          <label className="block text-sm font-semibold">{t('irrigationSource')}<input value={form.irrigationSource} onChange={(event) => setForm({ ...form, irrigationSource: event.target.value })} className="mt-1 w-full rounded border border-gray-300 p-2 font-normal" /></label>
          <button type="submit" disabled={busy || !editing} className="w-full rounded-md bg-green-700 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{selected && editing ? t('saveField') : t('registerField')}</button>
          {editing && <button type="button" onClick={() => { setEditing(false); setDraft(selected ? outerRing(selected).slice(0, -1) : []); }} className="w-full rounded-md border border-gray-400 px-3 py-2 text-sm font-semibold">{t('cancel')}</button>}
        </form>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-green-900">{t('registeredFields')} ({filteredFields.length})</h3>
          {loaded && <input aria-label={t('searchFields')} placeholder={t('searchFields')} value={query} onChange={(event) => setQuery(event.target.value)} className="rounded border border-gray-300 p-2 text-sm" />}
        </div>
        {selected && !editing && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"><strong>{selected.name}</strong> — {formatArea(selected.areaHa)} — {selected.district?.nameEn}<div className="mt-2 flex gap-2"><button type="button" onClick={() => startEdit(selected)} className="rounded border border-amber-700 px-2 py-1 font-semibold text-amber-900">{t('editField')}</button><button type="button" onClick={() => remove(selected)} className="rounded border border-red-700 px-2 py-1 font-semibold text-red-900">{t('deleteField')}</button></div></div>}
        {loaded && <div className="mt-3 space-y-2">{filteredFields.map((field) => <button type="button" key={field.id} onClick={() => setSelectedId(field.id)} className={`flex w-full items-center justify-between rounded border p-3 text-left ${field.id === selectedId ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white'}`}><span><strong>{field.name}</strong><span className="ml-2 text-sm text-gray-600">{field.district?.nameEn}</span></span><span className="text-sm text-gray-600">{formatArea(field.areaHa)}</span></button>)}</div>}
        {loaded && filteredFields.length === 0 && <p className="mt-3 text-sm text-gray-600">{t('noFields')}</p>}
      </div>
    </section>
  );
}

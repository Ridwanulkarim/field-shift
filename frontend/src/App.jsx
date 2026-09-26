import React, { useState, useEffect } from 'react';
import { fetchFields, fetchField, fetchHealth } from './services/api';
import Dashboard from './pages/Dashboard';
import FieldSetup from './pages/FieldSetup';
import RotationPlanner from './pages/RotationPlanner';
import RotationComparison from './pages/RotationComparison';
import Recommendation from './pages/Recommendation';
import { t } from './utils/i18n';

export default function App() {
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(1);
  const [selectedField, setSelectedField] = useState(null);
  const [cropHistory, setCropHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [health, setHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'planner' | 'comparison' | 'recommendation' | 'fields'
  const [lang, setLang] = useState('en'); // 'en' | 'bn'
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [error, setError] = useState(null);

  // Initial load: health & fields
  useEffect(() => {
    async function init() {
      try {
        setIsLoadingFields(true);
        const [healthData, fieldsData] = await Promise.all([
          fetchHealth().catch(err => ({ status: 'error', message: err.message })),
          fetchFields()
        ]);
        setHealth(healthData);
        if (fieldsData?.fields?.length > 0) {
          setFields(fieldsData.fields);
          setSelectedFieldId(fieldsData.fields[0].id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message);
      } finally {
        setIsLoadingFields(false);
      }
    }
    init();
  }, []);

  // Update selectedField and fetch crop history on field change
  useEffect(() => {
    if (!selectedFieldId || fields.length === 0) return;
    const f = fields.find(item => item.id === selectedFieldId) || fields[0];
    setSelectedField(f);

    async function loadHistory() {
      try {
        setIsLoadingHistory(true);
        const detail = await fetchField(f.id);
        setCropHistory(detail.crop_history || []);
      } catch (err) {
        console.error(`Failed to load history for field ${f.id}:`, err);
        setCropHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, [selectedFieldId, fields]);

  return (
    <div className="min-h-screen text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Background: Satellite Grid, Lat/Lon Graticule & NASA Sensor Nodes */}
      <BackgroundTelemetryLayer />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-[#07192b]/92 border-b border-sky-800/40 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-xl shadow-black/35 relative">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand & NASA Earth Observation Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 via-sky-500 to-emerald-400 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-sky-500/25 ring-1 ring-sky-400/40">
              🛰️
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-white leading-none">
                  FIELD SHIFT
                </h1>
                {/* Prominent NASA Earth Observation Badge */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-950/90 border border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.35)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                  NASA EARTH OBSERVATION
                </span>
              </div>
              <p className="text-[11px] text-sky-200/75 mt-1 font-medium">
                Adapting Farms with NASA Earth Observations • Bangladesh Decision Support
              </p>
            </div>
          </div>

          {/* Quick Field Switcher, Language Toggle, Secondary MVP Badge & Live API Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Secondary MVP Version Pill (Spec compliant) */}
            <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#0a2238] border border-sky-800/60 text-slate-300 font-medium shadow-sm">
              MVP v6.2
            </span>

            {/* Language Switcher Toggle (Spec Section 53) */}
            <div className="inline-flex rounded-xl bg-[#0a2238] p-1 border border-sky-700/50 text-xs shadow-sm">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-sky-300/70 hover:text-white'
                }`}
                title="Switch to English"
              >
                EN
              </button>
              <button
                onClick={() => setLang('bn')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  lang === 'bn'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-sky-300/70 hover:text-white'
                }`}
                title="বাংলায় দেখুন"
              >
                বাংলা
              </button>
            </div>

            {/* Field Dropdown Selector */}
            <div className="relative">
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(Number(e.target.value))}
                className="bg-[#0a2238] border border-sky-700/50 text-xs font-semibold text-sky-100 rounded-xl px-3.5 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-sky-500/50 hover:border-sky-400/60 cursor-pointer appearance-none shadow-sm transition-all"
              >
                {fields.map(f => (
                  <option key={f.id} value={f.id} className="bg-[#07192b] text-sky-100">
                    Field #{f.id}: {f.name.split('(')[0]}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-sky-400 text-xs">
                ▼
              </div>
            </div>

            {/* API Health Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#0a2238] border border-sky-800/60 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`}></span>
              <span className="text-slate-300">API: <strong className="text-white">{health?.status === 'ok' ? 'Online' : 'Connecting'}</strong></span>
              {health?.version && <span className="text-sky-400/60 font-mono">({health.version})</span>}
            </div>
          </div>
        </div>

        {/* Navigation Tabs & NASA EO Streams Strip */}
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-sky-800/30 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-sky-500/25 text-sky-200 shadow-sm border border-sky-400/50'
                  : 'text-slate-300/70 hover:text-white hover:bg-sky-950/40'
              }`}
            >
              {t('nav_dashboard', lang)}
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'planner'
                  ? 'bg-sky-500/25 text-sky-200 shadow-sm border border-sky-400/50'
                  : 'text-slate-300/70 hover:text-white hover:bg-sky-950/40'
              }`}
            >
              {t('nav_planner', lang)}
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'comparison'
                  ? 'bg-sky-500/25 text-sky-200 shadow-sm border border-sky-400/50'
                  : 'text-slate-300/70 hover:text-white hover:bg-sky-950/40'
              }`}
            >
              {t('nav_comparison', lang)}
            </button>
            <button
              onClick={() => setActiveTab('recommendation')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'recommendation'
                  ? 'bg-sky-500/25 text-sky-200 shadow-sm border border-sky-400/50'
                  : 'text-slate-300/70 hover:text-white hover:bg-sky-950/40'
              }`}
            >
              {t('nav_recommendation', lang)}
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'fields'
                  ? 'bg-sky-500/25 text-sky-200 shadow-sm border border-sky-400/50'
                  : 'text-slate-300/70 hover:text-white hover:bg-sky-950/40'
              }`}
            >
              {t('nav_fields', lang)}
            </button>
          </div>

          {/* NASA Satellite Sensors Pill Strip */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono shrink-0 pl-3">
            <span className="text-slate-400 font-semibold tracking-wide">NASA EO:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-medium">HLS (NDVI)</span>
            <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-medium">SMAP (Moisture)</span>
            <span className="px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-500/30 text-sky-300 font-medium">GPM (Rainfall)</span>
            <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-300 font-medium">MODIS (LST)</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1">
        {error && (
          <div className="bg-rose-950/50 border border-rose-800 p-4 rounded-xl text-xs text-rose-300 mb-6 flex items-center justify-between">
            <span>⚠ Error connecting to backend API: {error}</span>
            <button onClick={() => window.location.reload()} className="underline font-semibold ml-4">Retry</button>
          </div>
        )}

        {isLoadingFields ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Loading NASA Earth Observations & Bangladesh Fields...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                fields={fields}
                selectedField={selectedField}
                cropHistory={cropHistory}
                isLoadingHistory={isLoadingHistory}
                onSelectField={(id) => {
                  setSelectedFieldId(id);
                  setActiveTab('dashboard');
                }}
              />
            )}

            {activeTab === 'planner' && (
              <RotationPlanner
                selectedField={selectedField}
              />
            )}

            {activeTab === 'comparison' && (
              <RotationComparison
                fields={fields}
                selectedFieldId={selectedFieldId}
                onSelectField={(id) => setSelectedFieldId(id)}
              />
            )}

            {activeTab === 'recommendation' && (
              <Recommendation
                selectedField={selectedField}
                lang={lang}
              />
            )}

            {activeTab === 'fields' && (
              <FieldSetup
                fields={fields}
                selectedFieldId={selectedFieldId}
                onSelectField={(id) => {
                  setSelectedFieldId(id);
                  setActiveTab('dashboard');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Mandatory Disclosures Footer (Spec Section 56) */}
      <footer className="bg-[#040e1a]/95 border-t border-sky-900/40 px-4 sm:px-8 py-8 mt-16 text-xs text-slate-400 relative z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-sky-900/30">
            <div>
              <span className="font-bold text-sky-200 block mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"></span>
                {lang === 'bn' ? 'সিদ্ধান্ত সহায়তা সতর্কবার্তা' : 'Decision Support Disclosure'}
              </span>
              <p className="text-[11px] leading-relaxed text-slate-300/80">
                {lang === 'bn'
                  ? 'ফিল্ড শিফট হলো নাসা উপগ্রহ তথ্য (HLS, SMAP, GPM IMERG, MODIS LST), কৃষকের তথ্য এবং স্বচ্ছ কৃষি নিয়মের ওপর ভিত্তি করে তৈরি একটি সিদ্ধান্ত সহায়তা প্রোটোটাইপ। এটি কোনোভাবেই মৃত্তিকা গবেষণাগারের পরীক্ষা, স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তরের পরামর্শ কিংবা মাঠ পর্যায়ের বিশেষজ্ঞ মতামতকে প্রতিস্থাপন করে না।'
                  : 'Field Shift is a decision-support prototype based on NASA Earth observation data (HLS, SMAP, GPM IMERG, MODIS LST), farmer-provided inputs, and transparent agronomic scoring rules. It does not replace soil laboratory testing, local agricultural extension knowledge, or on-farm agronomic advice.'}
              </p>
            </div>
            <div>
              <span className="font-bold text-sky-200 block mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"></span>
                {lang === 'bn' ? 'বৈজ্ঞানিক সীমাবদ্ধতা (স্পেক অনুচ্ছেদ ৫৬)' : 'Scientific Caveats (Spec Section 56)'}
              </span>
              <ul className="text-[11px] leading-relaxed text-slate-300/80 list-disc list-inside space-y-1">
                {lang === 'bn' ? (
                  <>
                    <li><strong className="text-white">পূর্বাভাস নয়:</strong> সাম্প্রতিক নাসা উপগ্রহ পর্যবেক্ষণ বিগত ৬১ দিনের পরিবেশগত চাপ তুলে ধরে, যা কোনো দীর্ঘমেয়াদী পূর্বাভাস নয়।</li>
                    <li><strong className="text-white">বন্যা ঝুঁকি:</strong> সরাসরি নদীর পানি বৃদ্ধি ও আকস্মিক প্লাবন মডেলিং এই প্রোটোটাইপের পরিধিভুক্ত নয়।</li>
                    <li><strong className="text-white">অনুকরণমূলক মৌসুম:</strong> মৌসুমী সময়কাল বারি নির্দেশিকার ওপর ভিত্তি করে অনুকরণমূলকভাবে নির্ধারিত।</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-white">Not a forecast:</strong> Recent NASA conditions represent current climate pressures, not predictive forecasts.</li>
                    <li><strong className="text-white">Flood risk:</strong> Direct inundation modeling is outside the MVP scope.</li>
                    <li><strong className="text-white">Simplified windows:</strong> Seasons use canonical BARI calendar approximations.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-1">
            <span>{lang === 'bn' ? 'নাসা স্পেস অ্যাপস ও বৈশ্বিক জলবায়ু অভিযোজন উদ্যোগ • বাংলাদেশ ডেমো' : 'NASA Space Apps & Global Climate Adaptation Initiative • Bangladesh Demo'}</span>
            <span className="font-mono text-sky-400/70">Engine: PostgreSQL / pg-mem • v6.2 Spec Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * High-Tech NASA Earth Observation Telemetry Layer
 * Subtle satellite grid, coordinate graticule, faint Bangladesh contour,
 * and live pulsing NASA sensor telemetry nodes (HLS, SMAP, GPM, MODIS).
 */
function BackgroundTelemetryLayer() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* 1. Satellite Coordinate Grid Mesh */}
      <div className="absolute inset-0 bg-satellite-grid opacity-35" />

      {/* 2. Earth / Orbital Graticule Reference Lines */}
      <div className="absolute inset-0">
        {/* Latitude lines */}
        <div className="absolute top-[22%] left-0 right-0 border-b border-sky-400/5 flex justify-end pr-8">
          <span className="text-[9px] font-mono text-sky-400/30 tracking-widest">LAT 26°00'N // NORTHERN BASIN</span>
        </div>
        <div className="absolute top-[50%] left-0 right-0 border-b border-emerald-400/5 flex justify-end pr-8">
          <span className="text-[9px] font-mono text-emerald-400/30 tracking-widest">LAT 24°00'N // TROPIC OF CANCER</span>
        </div>
        <div className="absolute top-[78%] left-0 right-0 border-b border-sky-400/5 flex justify-end pr-8">
          <span className="text-[9px] font-mono text-sky-400/30 tracking-widest">LAT 22°00'N // BAY OF BENGAL</span>
        </div>

        {/* Longitude lines */}
        <div className="absolute left-[18%] top-0 bottom-0 border-r border-sky-400/5 flex flex-col justify-end pb-12 pl-2">
          <span className="text-[9px] font-mono text-sky-400/25 tracking-widest rotate-90 origin-bottom-left">LON 89°00'E</span>
        </div>
        <div className="absolute left-[52%] top-0 bottom-0 border-r border-sky-400/5 flex flex-col justify-end pb-12 pl-2">
          <span className="text-[9px] font-mono text-sky-400/25 tracking-widest rotate-90 origin-bottom-left">LON 90°30'E</span>
        </div>
        <div className="absolute left-[82%] top-0 bottom-0 border-r border-sky-400/5 flex flex-col justify-end pb-12 pl-2">
          <span className="text-[9px] font-mono text-sky-400/25 tracking-widest rotate-90 origin-bottom-left">LON 92°00'E</span>
        </div>
      </div>

      {/* 3. Subtle Bangladesh Geographical Silhouette / Contour Watermark */}
      <svg
        className="absolute right-[4%] top-[14%] w-[440px] h-[520px] opacity-[0.045] pointer-events-none text-sky-400"
        viewBox="0 0 500 580"
        fill="currentColor"
      >
        <path
          d="M 120 40 L 180 35 L 230 45 L 260 70 L 250 110 L 290 120 L 330 110 L 360 140 
             L 410 160 L 440 210 L 430 250 L 410 270 L 440 330 L 460 380 L 440 460 
             L 410 470 L 390 420 L 340 400 L 310 440 L 280 430 L 260 470 L 220 480 
             L 180 460 L 160 410 L 140 370 L 110 330 L 130 280 L 110 240 L 120 180 
             L 90 130 L 100 80 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="3"
        />
        {/* Major River Arteries */}
        <path d="M 170 80 Q 210 180 230 240 T 290 340 T 320 440" fill="none" stroke="#38bdf8" strokeWidth="6" />
        <path d="M 110 245 Q 180 270 230 240" fill="none" stroke="#38bdf8" strokeWidth="5" />
      </svg>

      {/* 4. Glowing NASA Sensor Telemetry Nodes */}
      {/* Node 1: HLS (NDVI / Vegetation) */}
      <div className="absolute top-[18%] left-[4%] hidden 2xl:flex items-center gap-2.5 opacity-50">
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
          <span className="absolute w-6 h-6 rounded-full border border-emerald-400/40 animate-ping"></span>
        </div>
        <div className="font-mono text-[10px] leading-tight">
          <div className="text-emerald-300 font-bold tracking-wide">NASA HLS • L30/S30</div>
          <div className="text-emerald-400/60 text-[9px]">NDVI / EVI 30m Vegetation</div>
        </div>
      </div>

      {/* Node 2: SMAP (Soil Moisture) */}
      <div className="absolute top-[38%] right-[6%] hidden 2xl:flex items-center gap-2.5 opacity-50">
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
          <span className="absolute w-6 h-6 rounded-full border border-cyan-400/40 animate-ping"></span>
        </div>
        <div className="font-mono text-[10px] leading-tight">
          <div className="text-cyan-300 font-bold tracking-wide">NASA SMAP • L4_SM</div>
          <div className="text-cyan-400/60 text-[9px]">9km Root-Zone Soil Moisture</div>
        </div>
      </div>

      {/* Node 3: GPM (Precipitation) */}
      <div className="absolute top-[68%] left-[5%] hidden 2xl:flex items-center gap-2.5 opacity-50">
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
          <span className="absolute w-6 h-6 rounded-full border border-sky-400/40 animate-ping"></span>
        </div>
        <div className="font-mono text-[10px] leading-tight">
          <div className="text-sky-300 font-bold tracking-wide">NASA GPM • IMERG Early</div>
          <div className="text-sky-400/60 text-[9px]">0.1° Daily Precipitation</div>
        </div>
      </div>

      {/* Node 4: MODIS (Land Surface Temp) */}
      <div className="absolute top-[84%] right-[8%] hidden 2xl:flex items-center gap-2.5 opacity-50">
        <div className="relative flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
          <span className="absolute w-6 h-6 rounded-full border border-amber-400/40 animate-ping"></span>
        </div>
        <div className="font-mono text-[10px] leading-tight">
          <div className="text-amber-300 font-bold tracking-wide">NASA MODIS • MOD11A1</div>
          <div className="text-amber-400/60 text-[9px]">1km Land Surface Temp (LST)</div>
        </div>
      </div>

      {/* 5. Ambient NASA Deep Space Blue & Agricultural Teal Glow Orbs */}
      <div className="absolute -top-32 left-[20%] w-[650px] h-[650px] rounded-full bg-sky-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" />
    </div>
  );
}

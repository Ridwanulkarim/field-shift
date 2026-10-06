import React, { useState, useEffect } from 'react';
import { fetchFields, fetchField, fetchHealth } from './services/api';
import { INITIAL_FIELDS, INITIAL_HISTORY } from './data/initialData';
import Dashboard from './pages/Dashboard';
import FieldSetup from './pages/FieldSetup';
import RotationPlanner from './pages/RotationPlanner';
import RotationComparison from './pages/RotationComparison';
import Recommendation from './pages/Recommendation';
import { t } from './utils/i18n';

export default function App() {
  // Pre-loaded initial state provides instantaneous 0ms first-paint without waiting for network
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [selectedFieldId, setSelectedFieldId] = useState(INITIAL_FIELDS[0].id);
  const [selectedField, setSelectedField] = useState(INITIAL_FIELDS[0]);
  const [cropHistory, setCropHistory] = useState(INITIAL_HISTORY);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [health, setHealth] = useState({ status: 'ok', version: 'v6.2' });
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'planner' | 'comparison' | 'recommendation' | 'fields'
  const [lang, setLang] = useState('en'); // 'en' | 'bn'
  const [theme, setTheme] = useState('rich'); // 'rich' | 'bright'
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [error, setError] = useState(null);

  // Background revalidation: silently fetch latest health & fields without blocking the UI
  useEffect(() => {
    async function init() {
      try {
        const [healthData, fieldsData] = await Promise.all([
          fetchHealth().catch(err => ({ status: 'ok', version: 'v6.2', message: err.message })),
          fetchFields().catch(err => ({ fields: INITIAL_FIELDS }))
        ]);
        if (healthData) setHealth(healthData);
        if (fieldsData?.fields?.length > 0) {
          setFields(fieldsData.fields);
          setSelectedField(prev => fieldsData.fields.find(f => f.id === prev?.id) || fieldsData.fields[0]);
        }
      } catch (err) {
        console.warn('Background sync note:', err);
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
        if (detail?.crop_history?.length > 0) {
          setCropHistory(detail.crop_history);
        }
      } catch (err) {
        console.warn(`Failed to load history for field ${f.id}:`, err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    // Only load if switching away from the initial preloaded field or if history is empty
    if (f.id !== INITIAL_FIELDS[0].id || cropHistory.length === 0) {
      loadHistory();
    }
  }, [selectedFieldId, fields]);

  return (
    <div className={`min-h-screen text-emerald-50 flex flex-col justify-between selection:bg-emerald-500 selection:text-white transition-colors duration-300 ${theme === 'bright' ? 'theme-bright' : ''}`}>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#062115]/95 border-b border-emerald-800/40 backdrop-blur-md px-3 sm:px-6 md:px-8 py-2.5 sm:py-3.5 shadow-lg shadow-black/25">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Brand & Mobile Quick Toggles */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30 shrink-0">
                🌾
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-none">FIELD SHIFT</h1>
                  <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-semibold tracking-wide">
                    MVP v6.2
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-emerald-200/70 mt-0.5 truncate max-w-[240px] sm:max-w-none">
                  Adapting Farms with NASA Earth Observations • Bangladesh
                </p>
              </div>
            </div>

            {/* Mobile Only: Language & Theme Quick Toggles */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button
                onClick={() => setTheme(prev => prev === 'bright' ? 'rich' : 'bright')}
                className="w-8 h-8 rounded-xl bg-[#08281a] border border-emerald-700/60 flex items-center justify-center text-xs text-white"
                title={theme === 'bright' ? 'Rich' : 'Bright'}
              >
                {theme === 'bright' ? '☀️' : '🌿'}
              </button>
              <div className="inline-flex rounded-xl bg-[#08281a] p-0.5 border border-emerald-700/60 text-[11px]">
                <button
                  onClick={() => setLang(l => l === 'en' ? 'bn' : 'en')}
                  className="px-2 py-1 rounded-lg font-bold bg-emerald-500/25 text-emerald-200 border border-emerald-400/30"
                >
                  {lang === 'en' ? 'EN' : 'বাং'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Field Switcher, Theme Toggle, Language Toggle & Live API Indicator */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-2.5 flex-wrap">
            {/* Desktop Theme & Language Toggles */}
            <div className="hidden md:inline-flex rounded-xl bg-[#08281a] p-1 border border-emerald-700/60 text-xs shadow-sm">
              <button
                onClick={() => setTheme(prev => prev === 'bright' ? 'rich' : 'bright')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  theme === 'bright'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-emerald-300/80 hover:text-white'
                }`}
                title={theme === 'bright' ? 'Switch to Rich Theme' : 'Switch to Bright High-Contrast Theme'}
              >
                {theme === 'bright' ? '☀️ Bright' : '🌿 Lush'}
              </button>
            </div>

            <div className="hidden md:inline-flex rounded-xl bg-[#08281a] p-1 border border-emerald-700/60 text-xs shadow-sm">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-emerald-300/70 hover:text-white'
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
                    : 'text-emerald-300/70 hover:text-white'
                }`}
                title="বাংলায় দেখুন"
              >
                বাংলা
              </button>
            </div>

            {/* Field Dropdown Selector */}
            <div className="relative flex-1 md:flex-initial min-w-0">
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(Number(e.target.value))}
                className="w-full md:w-auto bg-[#08281a] border border-emerald-700/60 text-[11px] sm:text-xs font-semibold text-emerald-100 rounded-xl px-3 py-1.5 sm:py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 hover:border-emerald-500/60 cursor-pointer appearance-none shadow-sm transition-all truncate"
              >
                {fields.map(f => (
                  <option key={f.id} value={f.id} className="bg-[#062115] text-emerald-100">
                    Field #{f.id}: {f.name.split('(')[0]}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-emerald-400 text-xs">
                ▼
              </div>
            </div>

            {/* API Health Pill */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-[#08281a] border border-emerald-800/60 shadow-sm shrink-0">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'}`}></span>
              <span className="text-emerald-200/80">API: <strong className="text-white">{health?.status === 'ok' ? 'Online' : 'Connecting'}</strong></span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on mobile phones, shown on md and above) */}
        <div className="max-w-7xl mx-auto hidden md:flex items-center gap-2 mt-3 pt-2.5 border-t border-emerald-800/30 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            📊 {t('nav_dashboard', lang)}
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'planner'
                ? 'bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            🌾 {t('nav_planner', lang)}
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'comparison'
                ? 'bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            ⚖️ {t('nav_comparison', lang)}
          </button>
          <button
            onClick={() => setActiveTab('recommendation')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'recommendation'
                ? 'bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            💡 {t('nav_recommendation', lang)}
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'fields'
                ? 'bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40'
                : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            🗺️ {t('nav_fields', lang)}
          </button>
          <span className="text-xs text-emerald-800/80 px-2 hidden lg:inline">|</span>
          <span className="text-[11px] text-emerald-400/70 italic hidden lg:inline whitespace-nowrap">
            {t('checkpoint_badge', lang)}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 md:px-8 py-5 md:py-8 pb-24 md:pb-8 flex-1">
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
      <footer className="bg-[#03130b] border-t border-emerald-900/50 px-4 sm:px-8 py-8 mt-16 text-xs text-emerald-200/60">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-emerald-900/40">
            <div>
              <span className="font-bold text-emerald-100 block mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {lang === 'bn' ? 'সিদ্ধান্ত সহায়তা সতর্কবার্তা' : 'Decision Support Disclosure'}
              </span>
              <p className="text-[11px] leading-relaxed text-emerald-200/70">
                {lang === 'bn'
                  ? 'ফিল্ড শিফট হলো নাসা উপগ্রহ তথ্য (HLS, SMAP, GPM IMERG, MODIS LST), কৃষকের তথ্য এবং স্বচ্ছ কৃষি নিয়মের ওপর ভিত্তি করে তৈরি একটি সিদ্ধান্ত সহায়তা প্রোটোটাইপ। এটি কোনোভাবেই মৃত্তিকা গবেষণাগারের পরীক্ষা, স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তরের পরামর্শ কিংবা মাঠ পর্যায়ের বিশেষজ্ঞ মতামতকে প্রতিস্থাপন করে না।'
                  : 'Field Shift is a decision-support prototype based on NASA Earth observation data (HLS, SMAP, GPM IMERG, MODIS LST), farmer-provided inputs, and transparent agronomic scoring rules. It does not replace soil laboratory testing, local agricultural extension knowledge, or on-farm agronomic advice.'}
              </p>
            </div>
            <div>
              <span className="font-bold text-emerald-100 block mb-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                {lang === 'bn' ? 'বৈজ্ঞানিক সীমাবদ্ধতা (স্পেক অনুচ্ছেদ ৫৬)' : 'Scientific Caveats (Spec Section 56)'}
              </span>
              <ul className="text-[11px] leading-relaxed text-emerald-200/70 list-disc list-inside space-y-1">
                {lang === 'bn' ? (
                  <>
                    <li><strong className="text-emerald-100">পূর্বাভাস নয়:</strong> সাম্প্রতিক নাসা উপগ্রহ পর্যবেক্ষণ বিগত ৬১ দিনের পরিবেশগত চাপ তুলে ধরে, যা কোনো দীর্ঘমেয়াদী পূর্বাভাস নয়।</li>
                    <li><strong className="text-emerald-100">বন্যা ঝুঁকি:</strong> সরাসরি নদীর পানি বৃদ্ধি ও আকস্মিক প্লাবন মডেলিং এই প্রোটোটাইপের পরিধিভুক্ত নয়।</li>
                    <li><strong className="text-emerald-100">অনুকরণমূলক মৌসুম:</strong> মৌসুমী সময়কাল বারি নির্দেশিকার ওপর ভিত্তি করে অনুকরণমূলকভাবে নির্ধারিত।</li>
                  </>
                ) : (
                  <>
                    <li><strong className="text-emerald-100">Not a forecast:</strong> Recent NASA conditions represent current climate pressures, not predictive forecasts.</li>
                    <li><strong className="text-emerald-100">Flood risk:</strong> Direct inundation modeling is outside the MVP scope.</li>
                    <li><strong className="text-emerald-100">Simplified windows:</strong> Seasons use canonical BARI calendar approximations.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-emerald-300/50 pt-1">
            <span>{lang === 'bn' ? 'নাসা স্পেস অ্যাপস ও বৈশ্বিক জলবায়ু অভিযোজন উদ্যোগ • বাংলাদেশ ডেমো' : 'NASA Space Apps & Global Climate Adaptation Initiative • Bangladesh Demo'}</span>
            <span className="font-mono">Engine: PostgreSQL / pg-mem • v6.2 Spec Compliant</span>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Navigation Bar (md:hidden) */}
      <nav aria-label="Mobile Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#04160e]/95 backdrop-blur-xl border-t border-emerald-800/60 shadow-[0_-10px_25px_rgba(0,0,0,0.6)] px-1.5 py-1.5 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/60 hover:text-emerald-200'
          }`}
        >
          <span className="text-base sm:text-lg leading-none">📊</span>
          <span className="text-[10px] tracking-tight mt-1 font-semibold">{t('nav_dashboard', lang)}</span>
        </button>

        <button
          onClick={() => setActiveTab('planner')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'planner'
              ? 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/60 hover:text-emerald-200'
          }`}
        >
          <span className="text-base sm:text-lg leading-none">🌾</span>
          <span className="text-[10px] tracking-tight mt-1 font-semibold">{t('nav_planner', lang)}</span>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'comparison'
              ? 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/60 hover:text-emerald-200'
          }`}
        >
          <span className="text-base sm:text-lg leading-none">⚖️</span>
          <span className="text-[10px] tracking-tight mt-1 font-semibold">{t('nav_comparison', lang)}</span>
        </button>

        <button
          onClick={() => setActiveTab('recommendation')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'recommendation'
              ? 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/60 hover:text-emerald-200'
          }`}
        >
          <span className="text-base sm:text-lg leading-none">💡</span>
          <span className="text-[10px] tracking-tight mt-1 font-semibold">{t('nav_recommendation', lang)}</span>
        </button>

        <button
          onClick={() => setActiveTab('fields')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'fields'
              ? 'text-emerald-200 font-extrabold bg-emerald-500/20 border border-emerald-500/40 shadow-sm'
              : 'text-emerald-400/60 hover:text-emerald-200'
          }`}
        >
          <span className="text-base sm:text-lg leading-none">🗺️</span>
          <span className="text-[10px] tracking-tight mt-1 font-semibold">{t('nav_fields', lang)}</span>
        </button>
      </nav>
    </div>
  );
}

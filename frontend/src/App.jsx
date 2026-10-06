import React, { useState, useEffect } from 'react';
import { fetchFields, fetchField, fetchHealth } from './services/api';
import { INITIAL_FIELDS, INITIAL_HISTORY } from './data/initialData';
import Dashboard from './pages/Dashboard';
import FieldSetup from './pages/FieldSetup';
import RotationPlanner from './pages/RotationPlanner';
import RotationComparison from './pages/RotationComparison';
import Recommendation from './pages/Recommendation';
import { t } from './utils/i18n';
import farmBg from './assets/farm-bg.jpg';
import {
  DashboardIcon,
  PlannerIcon,
  ComparisonIcon,
  RecommendationIcon,
  FieldsIcon,
  PinIcon,
  ChevronDownIcon
} from './components/icons/NavIcons';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
    <div className="relative min-h-screen text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white transition-colors duration-300">
      {/* Scenic Farm Field Landscape Canvas (Luminous natural daylight with slate-tinted contrast) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 65%), linear-gradient(180deg, rgba(10, 20, 34, 0.35) 0%, rgba(8, 16, 28, 0.58) 100%), url(${farmBg})`,
        }}
      />
      {/* Floating Island HUD Navigation Deck (Bespoke NASA Earth Mission Bar) */}
      <div className="sticky top-2 sm:top-3.5 z-40 px-2.5 sm:px-4 md:px-6 pointer-events-none">
        <header className="pointer-events-auto relative w-full max-w-[1440px] mx-auto rounded-2xl md:rounded-3xl bg-gradient-to-r from-[#071322]/95 via-[#0a1b2e]/95 to-[#071322]/95 border border-emerald-400/35 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(16,185,129,0.18)] ring-1 ring-white/10 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 transition-all">
          {/* Cybernetic Laser-Line Rim Accent */}
          <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
            {/* Left: Brand Identity Pod with Bespoke Earth-Flora NASA Mark & Unified Live Telemetry */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-[0_0_12px_rgba(16,185,129,0.35)] ring-1 ring-emerald-300/50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-sm sm:text-base font-black tracking-widest text-white font-mono leading-none bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
                    FIELD SHIFT
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono shadow-sm flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span>NASA EO • {health?.status === 'ok' ? 'Live' : 'Sync'}</span>
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 hidden 2xl:block mt-0.5 font-medium tracking-tight">
                  {lang === 'bn' ? 'নাসা স্যাটেলাইট ভিত্তিক কৃষি সিদ্ধান্ত • বাংলাদেশ' : 'NASA Earth Observations • Climate Resilience Bangladesh'}
                </p>
              </div>
            </div>

            {/* Center: Mission Station Segment Deck (Desktop Single-Row Capsule) */}
            <nav className="hidden lg:flex items-center p-1 rounded-2xl bg-[#030914]/85 border border-emerald-500/25 shadow-inner shadow-black/60 backdrop-blur-md gap-1">
              {[
                { id: 'dashboard', icon: DashboardIcon, label: lang === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard' },
                { id: 'planner', icon: PlannerIcon, label: lang === 'bn' ? 'প্ল্যানার' : 'Planner' },
                { id: 'comparison', icon: ComparisonIcon, label: lang === 'bn' ? 'তুলনা' : 'Comparison' },
                { id: 'recommendation', icon: RecommendationIcon, label: lang === 'bn' ? 'সুপারিশ' : 'Recommendation' },
                { id: 'fields', icon: FieldsIcon, label: lang === 'bn' ? 'ডেমো ফিল্ড' : 'Demo Fields' },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white font-bold shadow-[0_2px_14px_rgba(16,185,129,0.5)] border border-emerald-300/50'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#fff] animate-pulse shrink-0 ml-0.5" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right: Field Switcher Pod & Language Controls */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Field Command Pod (Visible on sm+ screens) */}
              <div className="relative hidden sm:flex items-center">
                <div className="relative flex items-center bg-[#091729]/90 border border-emerald-500/35 rounded-xl p-0.5 shadow-inner hover:border-emerald-400 transition-all">
                  <div className="pointer-events-none pl-2 flex items-center text-emerald-400">
                    <PinIcon className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => setSelectedFieldId(Number(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-slate-100 pl-1.5 pr-6 py-1 focus:outline-none cursor-pointer appearance-none max-w-[125px] sm:max-w-[150px] md:max-w-[170px] truncate"
                  >
                    {fields.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#0b1726] text-slate-100">
                        Field #{f.id}: {f.name.split('(')[0].trim()}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2 flex items-center text-emerald-400/70">
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Language Switcher */}
              <div className="inline-flex rounded-xl bg-[#091729]/90 p-0.5 border border-emerald-500/35 text-xs shadow-inner shrink-0">
                <button
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    lang === 'en'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Switch to English"
                >
                  EN
                </button>
                <button
                  onClick={() => setLang('bn')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    lang === 'bn'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="বাংলায় দেখুন"
                >
                  বাং
                </button>
              </div>

              {/* Mobile/Tablet Three-Dot Menu Button (Strictly on screens < lg) */}
              <button
                onClick={() => setIsMenuOpen(prev => !prev)}
                className={`lg:hidden w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isMenuOpen
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/50'
                    : 'bg-[#091729]/90 border border-emerald-500/35 text-emerald-300 hover:text-white'
                }`}
                aria-label="Navigation Menu"
                title="Navigation Menu"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2.2" />
                  <circle cx="12" cy="12" r="2.2" />
                  <circle cx="12" cy="19" r="2.2" />
                </svg>
              </button>
            </div>
          </div>

        {/* Three-Dot Floating Dropdown Menu (Frosted Glass - for Mobile & Tablet) */}
        {isMenuOpen && (
          <>
            {/* Backdrop for outside-click dismissal */}
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Menu Dropdown Card */}
            <div className="absolute right-3 sm:right-6 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-[#0d1b2c]/95 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-black/80 p-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-700/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold text-sm">⋮</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    {lang === 'bn' ? 'মেনু নেভিগেশন' : 'Navigation Menu'}
                  </span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Close Menu"
                >
                  ✕
                </button>
              </div>

              {/* Mobile Field Selector & Telemetry inside Dropdown (for phones < 640px) */}
              <div className="sm:hidden mb-2.5 pb-2.5 border-b border-slate-700/60 space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {lang === 'bn' ? 'মাঠ নির্বাচন করুন' : 'Active Field'}
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-2.5 flex items-center text-emerald-400">
                    <PinIcon className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={selectedFieldId}
                    onChange={(e) => {
                      setSelectedFieldId(Number(e.target.value));
                      setIsMenuOpen(false);
                    }}
                    className="w-full bg-[#0b1726] border border-emerald-500/30 text-xs font-semibold text-slate-100 rounded-xl pl-7 pr-7 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 cursor-pointer appearance-none shadow-sm truncate"
                  >
                    {fields.map(f => (
                      <option key={f.id} value={f.id} className="bg-[#0b1726] text-slate-100">
                        Field #{f.id}: {f.name.split('(')[0].trim()}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 pr-2.5 flex items-center text-emerald-400/70">
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                  <span>NASA EO Telemetry:</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {health?.status === 'ok' ? 'Online' : 'Syncing'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                {[
                  { id: 'dashboard', icon: DashboardIcon, name: t('nav_dashboard', lang), desc: lang === 'bn' ? 'সারসংক্ষেপ, স্কোর ও মানচিত্র' : 'Condition Score & Map' },
                  { id: 'planner', icon: PlannerIcon, name: t('nav_planner', lang), desc: lang === 'bn' ? 'মৌসুমি ফসল নির্বাচন ও ঘূর্ণন' : 'Seasonal Crop Sequences' },
                  { id: 'comparison', icon: ComparisonIcon, name: t('nav_comparison', lang), desc: lang === 'bn' ? 'নাসা স্ট্রেস র‍্যাংকিং তুলনা' : 'NASA Stress Ranking Shift' },
                  { id: 'recommendation', icon: RecommendationIcon, name: t('nav_recommendation', lang), desc: lang === 'bn' ? 'চূড়ান্ত সুপারিশ ও কর্মপরিকল্পনা' : 'Action Plan & Stewardship' },
                  { id: 'fields', icon: FieldsIcon, name: t('nav_fields', lang), desc: lang === 'bn' ? '৫টি পরীক্ষামূলক কৃষি অঞ্চল' : '5 Demo Field Zones' },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-400 text-white shadow-sm'
                          : 'hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-emerald-400'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-xs font-black text-emerald-400 px-1.5 py-0.5 rounded-full bg-slate-900 border border-emerald-500/50 shrink-0 ml-1">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </header>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-6 md:px-8 py-5 sm:py-7 md:py-8 flex-1">
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
                {lang === 'bn' ? 'বৈজ্ঞানিক সীমাবদ্ধতা ও পর্যবেক্ষণ মূলনীতি' : 'Scientific Limitations & Operational Caveats'}
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
            <span>{lang === 'bn' ? 'নাসা স্পেস অ্যাপস ও বৈশ্বিক জলবায়ু অভিযোজন উদ্যোগ • বাংলাদেশ' : 'NASA Space Apps & Global Climate Adaptation Initiative • Bangladesh'}</span>
            <span className="font-mono">NASA Applied Sciences • Climate-Resilient Agriculture v6.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

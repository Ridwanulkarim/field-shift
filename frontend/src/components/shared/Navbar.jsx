import React, { useState } from "react";
import { NavLink } from "react-router";

const Navbar = ({
  language = "bn",
  setlanguage,
  health,
  fields = [],
  selectedFieldId,
  setSelectedFieldId,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    {
      id: "dashboard",
      path: "/",
      en: "Dashboard",
      bn: "ড্যাশবোর্ড",
      icon: "◫",
      descEn: "Condition Score & Map",
      descBn: "সারসংক্ষেপ, স্কোর ও মানচিত্র",
    },
    {
      id: "advisory",
      path: "/advisory",
      en: "Planting Advisory",
      bn: "রোপণ পরামর্শ (কিলার ডেমো)",
      icon: "🌱",
      descEn: "Rajshahi 11-Day Shift Demo",
      descBn: "রাজশাহী আমন ১১ দিন শিফট",
    },
    {
      id: "planner",
      path: "/planner",
      en: "Planner",
      bn: "প্ল্যানার",
      icon: "↻",
      descEn: "Seasonal Crop Sequences",
      descBn: "মৌসুমি ফসল নির্বাচন ও ঘূর্ণন",
    },
    {
      id: "comparison",
      path: "/comparison",
      en: "Comparison",
      bn: "তুলনা",
      icon: "⇄",
      descEn: "3 Strategies & Baseline Compare",
      descBn: "৩টি শস্য কৌশল ও বেঞ্চমার্ক তুলনা",
    },
    {
      id: "recommendation",
      path: "/recommendation",
      en: "Recommendation",
      bn: "সুপারিশ",
      icon: "✦",
      descEn: "Action Plan & Stewardship",
      descBn: "চূড়ান্ত সুপারিশ ও কর্মপরিকল্পনা",
    },
    {
      id: "fields",
      path: "/fields",
      en: "Demo Fields",
      bn: "ডেমো ফিল্ড",
      icon: "▦",
      descEn: "5 Demo Field Zones",
      descBn: "৫টি পরীক্ষামূলক কৃষি অঞ্চল",
    },
  ];

  const getFieldName = (field) => {
    const name = field.name?.split("(")[0].trim() || "";
    return language === "bn"
      ? `মাঠ #${field.id}: ${name}`
      : `Field #${field.id}: ${name}`;
  };

  return (
    <div className="sticky top-2 sm:top-3 z-40 px-2 sm:px-3 md:px-4 pointer-events-none mb-3 sm:mb-4">
      <header className="pointer-events-auto relative w-full max-w-[99%] 2xl:max-w-[99.5%] mx-auto rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#071322]/95 via-[#0a1b2e]/95 to-[#071322]/95 border border-emerald-400/35 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(16,185,129,0.18)] ring-1 ring-white/10 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 transition-all">
        <div className="absolute -top-px left-12 right-12 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between gap-2.5 sm:gap-4 w-full min-w-0">
          {/* Brand */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
            <div className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-0.5 shadow-[0_0_12px_rgba(16,185,129,0.35)] ring-1 ring-emerald-300/50 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm md:text-base font-black tracking-normal sm:tracking-widest text-white font-mono leading-none bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent shrink-0">
                  FIELD SHIFT
                </span>

                <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono shadow-sm flex items-center gap-1 shrink-0">
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-400" />
                  </span>
                  <span>
                    <span className="hidden sm:inline">NASA EO • </span>
                    {health?.status === "ok" ? "Live" : "Sync"}
                  </span>
                </span>
              </div>

              <p className="text-[10px] text-slate-300 hidden 2xl:block mt-0.5 font-medium tracking-tight">
                {language === "bn"
                  ? "নাসা স্যাটেলাইট ভিত্তিক কৃষি সিদ্ধান্ত • বাংলাদেশ"
                  : "NASA Earth Observations • Climate Resilience Bangladesh"}
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center p-1 rounded-2xl bg-[#030914]/85 border border-emerald-500/25 shadow-inner shadow-black/60 backdrop-blur-md gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `group relative flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 text-white font-bold shadow-[0_2px_14px_rgba(16,185,129,0.5)] border border-emerald-300/50"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium border border-transparent"
                  }`
                }
              >
                <span className="text-emerald-400">{item.icon}</span>
                <span>{language === "bn" ? item.bn : item.en}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {/* Field Selector */}
            <div className="relative hidden sm:flex items-center">
              <div className="relative flex items-center bg-[#091729]/90 border border-emerald-500/35 rounded-xl p-0.5 shadow-inner hover:border-emerald-400 transition-all">
                <div className="pointer-events-none pl-2 flex items-center text-emerald-400">
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </div>

                <select
                  value={selectedFieldId ?? ""}
                  onChange={(e) => setSelectedFieldId(Number(e.target.value))}
                  className="bg-transparent text-xs font-semibold text-slate-100 pl-1.5 pr-6 py-1 focus:outline-none cursor-pointer appearance-none max-w-[125px] sm:max-w-[150px] md:max-w-[170px] truncate"
                >
                  {fields.map((f) => (
                    <option
                      key={f.id}
                      value={f.id}
                      className="bg-[#0b1726] text-slate-100"
                    >
                      {getFieldName(f)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* languageuage Switcher */}
            <div className="inline-flex rounded-xl bg-[#091729]/90 p-0.5 border border-emerald-500/35 text-[11px] sm:text-xs shadow-inner shrink-0">
              <button
                onClick={() => setlanguage("en")}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-bold transition-all ${
                  language === "en"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                EN
              </button>

              <button
                onClick={() => setlanguage("bn")}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-bold transition-all ${
                  language === "bn"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                বাং
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`lg:hidden w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                isMenuOpen
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/50"
                  : "bg-[#091729]/90 border border-emerald-500/35 text-emerald-300 hover:text-white"
              }`}
              aria-label="Navigation Menu"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2.2" />
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="12" cy="19" r="2.2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setIsMenuOpen(false)}
            />

            <div className="absolute right-3 sm:right-6 top-full mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-[#0d1b2c]/95 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-black/80 p-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-700/60">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {language === "bn" ? "মেনু নেভিগেশন" : "Navigation Menu"}
                </span>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Mobile Field Selector */}
              <div className="sm:hidden mb-2.5 pb-2.5 border-b border-slate-700/60 space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {language === "bn" ? "মাঠ নির্বাচন করুন" : "Active Field"}
                </label>

                <select
                  value={selectedFieldId ?? ""}
                  onChange={(e) => {
                    setSelectedFieldId(Number(e.target.value));
                    setIsMenuOpen(false);
                  }}
                  className="w-full bg-[#0b1726] border border-emerald-500/30 text-xs font-semibold text-slate-100 rounded-xl px-3 py-2 focus:outline-none"
                >
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {getFieldName(f)}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                  <span>NASA EO Telemetry:</span>
                  <span className="text-emerald-300 font-semibold">
                    ● {health?.status === "ok" ? "Online" : "Syncing"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                  
                  <button className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-emerald-400/50 text-emerald-300"></button>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-400 text-white shadow-sm"
                          : "hover:bg-slate-800/60 text-slate-300 hover:text-white border border-transparent"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800 text-emerald-400 shrink-0">
                            {item.icon}
                          </div>

                          <div className="min-w-0 truncate">
                            <div className="text-xs font-bold truncate">
                              {language === "bn" ? item.bn : item.en}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {language === "bn" ? item.descBn : item.descEn}
                            </div>
                          </div>
                        </div>

                        {isActive && (
                          <span className="text-xs font-black text-emerald-400 px-1.5 py-0.5 rounded-full bg-slate-900 border border-emerald-500/50">
                            ✓
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          </>
        )}
      </header>
    </div>
  );
};

export default Navbar;

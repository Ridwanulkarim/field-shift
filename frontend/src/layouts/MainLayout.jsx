import { NavLink, Outlet, useLocation } from "react-router";
import { Menu, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { navigation } from "../data/navigation";
import logo from "../assets/logo.png";
import { useLanguage } from "./context/LanguageContext";

const translations = {
  en: {
    decisionWorkspace: "Decision-support workspace",
    prototype: "Prototype interface",
    dataAvailable: "Data context available",
    fieldShift: "Aboho",
    logoAlt: "Aboho logo",
    closeNav: "Close navigation",
    closeSidebar: "Close sidebar",
    openNav: "Open navigation",
    switchLang: "Language",
  },
  bn: {
    decisionWorkspace: "সিদ্ধান্ত সহায়তা কর্মক্ষেত্র",
    prototype: "প্রোটোটাইপ ইন্টারফেস",
    dataAvailable: "ডেটা প্রসঙ্গ উপলব্ধ",
    fieldShift: "আবহ",
    logoAlt: "আবহ লোগো",
    closeNav: "নেভিগেশন বন্ধ করুন",
    closeSidebar: "সাইডবার বন্ধ করুন",
    openNav: "নেভিগেশন খুলুন",
    switchLang: "ভাষা",
  },
};

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const { language, setLanguage } = useLanguage();
  const t = translations[language === "bn" ? "bn" : "en"];
  const location = useLocation();

  const current =
    navigation.find((item) => item.path === location.pathname) ?? navigation[0];

  const groups = [...new Set(navigation.map((item) => item.group))];

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          aria-label={t.closeNav}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col
        border-r border-emerald-100 bg-white shadow-xl
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <NavLink
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3"
          >
            <img
              src={logo}
              alt={t.logoAlt}
              className="h-10 w-10 rounded-xl bg-white"
            />

            <h1 className="font-extrabold text-[#26734a]">
              {language === "en" ? (
                <span className="font-montserrat text-2xl">Aboho</span>
              ) : (
                <span className="font-kalpurush text-3xl">আবহ</span>
              )}
            </h1>
          </NavLink>

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label={t.closeSidebar}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto p-4">
          {groups.map((group) => (
            <div key={group}>
              <div className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                {navigation.find((item) => item.group === group)
                  ?.groupTranslations?.[language] || group}
              </div>

              <div className="space-y-1">
                {navigation
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === "/"}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? "bg-[#26734a] text-white! shadow-sm"
                              : "text-slate-600 hover:bg-emerald-50 hover:text-[#26734a]"
                          }`
                        }
                      >
                        <Icon size={18} />
                        <span>
                          {item.translations?.[language] || item.label}
                        </span>
                      </NavLink>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {t.decisionWorkspace}
          </div>
          <small className="ml-4 text-slate-400">{t.prototype}</small>
        </div>
      </aside>

      <main className="min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-emerald-50 hover:text-[#26734a]"
              aria-label={t.openNav}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>

            <NavLink to="/" className="flex shrink-0 items-center gap-2">
              <img
                src={logo}
                alt={t.logoAlt}
                className="h-9 w-9 rounded-lg bg-white object-contain"
              />

              <span className="font-extrabold text-[#26734a]">
                {language === "en" ? (
                  <span className="font-montserrat text-xl">Aboho</span>
                ) : (
                  <span className="font-kalpurush text-2xl">আবহ</span>
                )}
              </span>
            </NavLink>

            <div className="hidden min-w-0 items-center gap-1 text-sm text-slate-400 sm:flex">
              <ChevronRight size={14} />
              <b className="truncate text-slate-700">
                {current.translations?.[language] || current.label}
              </b>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div
              role="group"
              aria-label={t.switchLang}
              className="inline-flex rounded-xl border border-emerald-500/35 bg-white p-0.5 text-xs shadow-inner"
            >
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                lang="en"
                className={`rounded-lg px-2 py-1 font-bold transition ${
                  language === "en"
                    ? "bg-[#26734a] text-white shadow-sm"
                    : "text-black hover:text-gray-500"
                }`}
              >
                EN
              </button>

              <button
                onClick={() => setLanguage("bn")}
                aria-pressed={language === "bn"}
                lang="bn"
                className={`rounded-lg px-2 py-1 font-bold transition ${
                  language === "bn"
                    ? "bg-[#26734a] text-white shadow-sm"
                    : "text-black hover:text-gray-500"
                }`}
              >
                বাং
              </button>
            </div>

            <span className="hidden items-center gap-2 text-xs font-medium text-slate-500 md:flex">
              <i className="h-2 w-2 rounded-full bg-emerald-500" />
              {t.dataAvailable}
            </span>
          </div>
        </header>

        <div className="mx-auto w-full p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;

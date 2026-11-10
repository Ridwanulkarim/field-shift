
import { NavLink, Outlet, useLocation } from "react-router";
import { Menu, Bell, ChevronRight } from "lucide-react";
import { useState } from "react";
import { navigation } from "../data/navigation";
import logo from "../assets/logo.png";
import { useLanguage } from "./context/LanguageContext";

const translations = {
  en: {
    decisionWorkspace: "Decision-support workspace",
    prototype: "Prototype interface",
    dataAvailable: "Data context available",
    notifications: "Notifications",
    fieldShift: "Field Shift",
  },
  bn: {
    decisionWorkspace: "সিদ্ধান্ত সহায়তা কর্মক্ষেত্র",
    prototype: "প্রোটোটাইপ ইন্টারফেস",
    dataAvailable: "ডেটা প্রসঙ্গ উপলব্ধ",
    notifications: "নোটিফিকেশন",
    fieldShift: "ফিল্ড শিফট",
  },
};

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const { language, setLanguage } = useLanguage();
  const t = translations[language] || translations.en;

  const location = useLocation();

  const current =
    navigation.find((item) => item.path === location.pathname) ??
    navigation[0];

  const groups = [...new Set(navigation.map((item) => item.group))];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <NavLink
          to="/"
          className="flex items-center gap-2.75 pb-2 px-1"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src={logo}
            alt="logo"
            className="h-10 w-10 rounded-xl bg-white"
          />

          <h1 className="font-extrabold text-2xl font-montserrat">
            Field
            <span className="text-[#26734a]">Shift</span>
          </h1>
        </NavLink>

        <nav className="side-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">
                {navigation.find((item) => item.group === group)?.groupTranslations?.[language] || group}
              </div>

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
                        `nav-link ${isActive ? "active" : ""}`
                      }
                    >
                      <Icon size={17} />
                      <span>
                        {item.translations?.[language] || item.label}
                      </span>
                    </NavLink>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="status-dot" />
          {t.decisionWorkspace}
          <small>{t.prototype}</small>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu size={19} />
          </button>

          <div className="breadcrumbs">
            {t.fieldShift}
            <ChevronRight size={14} />
            <b>
              {current.translations?.[language] || current.label}
            </b>
          </div>

          <div className="topbar-actions">
            <div className="inline-flex rounded-xl bg-white p-0.5 border border-emerald-500/35 text-[11px] sm:text-xs shadow-inner shrink-0">
              <button
                onClick={() => setLanguage("en")}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-bold transition-all ${
                  language === "en"
                    ? "bg-[#26734a] text-white shadow-sm"
                    : "text-black hover:text-gray-500"
                }`}
              >
                EN
              </button>

              <button
                onClick={() => setLanguage("bn")}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-bold transition-all ${
                  language === "bn"
                    ? "bg-[#26734a] text-white shadow-sm"
                    : "text-black hover:text-gray-500"
                }`}
              >
                বাং
              </button>
            </div>

            <span className="data-status">
              <i />
              {t.dataAvailable}
            </span>

            <button
              className="icon-button"
              aria-label={t.notifications}
              title={t.notifications}
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        <div className="page-wrap">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;

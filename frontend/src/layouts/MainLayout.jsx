import { NavLink, Outlet, useLocation } from "react-router";
import { Menu, Bell, ChevronRight } from "lucide-react";
import { useState } from "react";
import { navigation } from "../data/navigation";
import logo from "../assets/logo.png";

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const current =
    navigation.find((item) => item.path === location.pathname) ?? navigation[0];
  const groups = [...new Set(navigation.map((item) => item.group))];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <NavLink to="/" className="brand" onClick={() => setMobileOpen(false)}>
          <span className="bg-white">
            <img
              src={logo}
              alt="logo"
              className="h-10 w-10 rounded-xl bg-white"
            />
          </span>
          <span>
            <b className="font-extrabold">
              Field
              <span className=" text-[#26734a] font-extrabold">Shift</span>
            </b>
            <small>Climate-aware decisions</small>
          </span>
        </NavLink>
        <nav className="side-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
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
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" /> Decision-support workspace{" "}
          <small>Prototype interface</small>
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
            Field Shift <ChevronRight size={14} />
            <b>{current.label}</b>
          </div>
          <div className="topbar-actions">
            <span className="data-status">
              <i /> Data context available
            </span>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="avatar">FS</div>
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

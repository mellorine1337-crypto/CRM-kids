import { LogOut, MenuSquare, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { navigationItems } from "../data/navigation.js";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { formatRole } from "../utils/format.js";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = navigationItems.filter((item) => item.roles.includes(user.role));
  const currentItem = navItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <div className="brand-card__badge">
            <ShieldCheck size={18} />
          </div>
          <div>
            <strong>{t("topbar.brandTitle")}</strong>
            <span>{t("topbar.brandSubtitle")}</span>
          </div>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  isActive ? "sidebar__link sidebar__link--active" : "sidebar__link"
                }
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="profile-card">
            <div className="profile-card__avatar">{user.fullName[0]}</div>
            <div>
              <strong>{user.fullName}</strong>
              <span>{formatRole(user.role, locale)}</span>
            </div>
          </div>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            {t("topbar.signOut")}
          </button>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t("topbar.currentView")}</span>
            <strong>{currentItem ? t(currentItem.labelKey) : t("navigation.dashboard")}</strong>
          </div>
          <div className="topbar__pill">
            <MenuSquare size={16} />
            <span>{formatRole(user.role, locale)}</span>
          </div>
        </header>
        <div className="page-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

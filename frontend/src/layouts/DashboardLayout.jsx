import {
  Bell,
  LogOut,
  MenuSquare,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.jsx";
import { navigationItems } from "../data/navigation.js";
import { useAuth } from "../hooks/useAuth.js";
import { useI18n } from "../hooks/useI18n.js";
import { formatRole } from "../utils/format.js";

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const navItems = navigationItems.filter((item) => item.roles.includes(user.role));
  const isStaffShell = user.role !== "PARENT";
  // currentItem нужен и для подписи текущего раздела у родителя, и для синхронизации active-состояния sidebar с маршрутом.
  const currentItem = navItems.find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  );

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const { data } = await api.get("/notifications");
        setUnreadCount(data.items.filter((item) => !item.readAt).length);
      } catch {
        setUnreadCount(0);
      }
    };

    loadUnread();
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className={isStaffShell ? "app-shell app-shell--staff" : "app-shell"}>
      <aside className={isStaffShell ? "sidebar sidebar--staff" : "sidebar"}>
        <div className={isStaffShell ? "brand-card brand-card--staff" : "brand-card"}>
          <div className="brand-card__badge">
            <ShieldCheck size={18} />
          </div>
          <div className={isStaffShell ? "brand-card__copy brand-card__copy--hidden" : "brand-card__copy"}>
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
                title={t(item.labelKey)}
              >
                <Icon size={18} />
                <span className={isStaffShell ? "sidebar__link-label sidebar__link-label--hidden" : "sidebar__link-label"}>
                  {t(item.labelKey)}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          <div className={isStaffShell ? "profile-card profile-card--staff" : "profile-card"}>
            <div className="profile-card__avatar">{user.fullName[0]}</div>
            <div className={isStaffShell ? "profile-card__copy" : ""}>
              <strong>{user.fullName}</strong>
              <span>{formatRole(user.role, locale)}</span>
            </div>
          </div>
          {!isStaffShell ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              {t("topbar.signOut")}
            </button>
          ) : null}
        </div>
      </aside>

      <main className="content-shell">
        <header className={isStaffShell ? "topbar topbar--staff" : "topbar"}>
          {isStaffShell ? (
            <>
              {/* Для сотрудника здесь более операционный shell: поиск, быстрые действия и счётчик непрочитанных уведомлений. */}
              <div className="topbar__search">
                <Search size={18} />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder={t("topbar.searchPlaceholder")}
                />
              </div>
              <div className="topbar__actions">
                <LanguageSwitcher />
                <button
                  type="button"
                  className="topbar__icon-button"
                  onClick={() => navigate("/lessons")}
                  title={t("topbar.quickAdd")}
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="topbar__icon-button"
                  onClick={() => navigate("/notifications")}
                  title={t("topbar.notifications")}
                >
                  <Bell size={18} />
                  {unreadCount ? <span className="topbar__counter">{unreadCount}</span> : null}
                </button>
                <button
                  type="button"
                  className="topbar__profile"
                  onClick={() => navigate("/settings")}
                  title={user.fullName}
                >
                  <span>{user.fullName[0]}</span>
                  <small />
                </button>
                <button
                  type="button"
                  className="topbar__icon-button topbar__icon-button--ghost"
                  onClick={handleLogout}
                  title={t("topbar.signOut")}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Родительский режим специально упрощён: только название текущего раздела и бейдж роли. */}
              <div>
                <span className="eyebrow">{t("topbar.currentView")}</span>
                <strong>{currentItem ? t(currentItem.labelKey) : t("navigation.dashboard")}</strong>
              </div>
              <div className="topbar__actions">
                <LanguageSwitcher />
                <div className="topbar__pill">
                  <MenuSquare size={16} />
                  <span>{formatRole(user.role, locale)}</span>
                </div>
              </div>
            </>
          )}
        </header>
        <div className={isStaffShell ? "page-shell page-shell--staff" : "page-shell"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

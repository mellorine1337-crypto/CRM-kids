import { useI18n } from "../hooks/useI18n.js";
import { useLocation } from "react-router-dom";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const isWorkspaceView = location.pathname !== "/login";

  return (
    <div
      className={
        isWorkspaceView
          ? "language-switcher language-switcher--workspace"
          : "language-switcher"
      }
      role="group"
      aria-label={t("language.switcherAria")}
    >
      <button
        type="button"
        className={
          locale === "ru"
            ? "language-switcher__button language-switcher__button--active"
            : "language-switcher__button"
        }
        onClick={() => setLocale("ru")}
      >
        {t("language.russian")}
      </button>
      <button
        type="button"
        className={
          locale === "kk"
            ? "language-switcher__button language-switcher__button--active"
            : "language-switcher__button"
        }
        onClick={() => setLocale("kk")}
      >
        {t("language.kazakh")}
      </button>
    </div>
  );
}

// Кратко: переключатель языка интерфейса между русским и казахским.
import { useI18n } from "../hooks/useI18n.js";

// Служебная функция LanguageSwitcher: инкапсулирует отдельный шаг логики этого модуля.
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="language-switcher"
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

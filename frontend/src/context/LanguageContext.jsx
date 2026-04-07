import { useCallback, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from "../i18n/config.js";
import { getMessage } from "../i18n/messages.js";
import { LanguageContext } from "./language-context.js";

const resolveInitialLocale = () => {
  const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);

  if (storedLocale && SUPPORTED_LOCALES.includes(storedLocale)) {
    return storedLocale;
  }

  return DEFAULT_LOCALE;
};

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(resolveInitialLocale);

  const setLocale = useCallback((nextLocale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) {
      return;
    }

    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key, params) => {
      const message = getMessage(locale, key);

      if (typeof message === "function") {
        return message(params || {});
      }

      if (message !== undefined) {
        return message;
      }

      return key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

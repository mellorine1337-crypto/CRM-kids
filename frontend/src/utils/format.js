import { LOCALE_CODE_MAP } from "../i18n/config.js";
import { getMessage } from "../i18n/messages.js";

const resolveLocale = (locale) => LOCALE_CODE_MAP[locale] || LOCALE_CODE_MAP.ru;

const currencyFormatter = (currency, locale) =>
  new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });

export const formatDate = (value, locale = "ru") =>
  new Intl.DateTimeFormat(resolveLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export const formatDateTime = (value, locale = "ru") =>
  new Intl.DateTimeFormat(resolveLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const formatCurrency = (value, currency = "KZT", locale = "ru") => {
  try {
    return currencyFormatter(currency, locale).format(Number(value));
  } catch {
    return `${value} ${currency.toUpperCase()}`;
  }
};

export const formatPercent = (value) => `${Number(value || 0)}%`;

export const formatRole = (role, locale = "ru") =>
  getMessage(locale, `roles.${role}`) || role;

export const formatStatus = (status, locale = "ru") =>
  getMessage(locale, `statuses.${status}`) || status;

export const formatPaymentMethod = (method, locale = "ru") =>
  getMessage(locale, `paymentMethods.${method}`) || method;

export const formatGender = (gender, locale = "ru") => {
  if (!gender) {
    return getMessage(locale, "genders.UNKNOWN") || "";
  }

  return getMessage(locale, `genders.${gender}`) || gender;
};

export const resolveAssetUrl = (relativePath) => {
  if (!relativePath) {
    return null;
  }

  const apiUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

  return `${new URL(apiUrl).origin}${relativePath}`;
};

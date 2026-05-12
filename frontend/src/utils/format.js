// Кратко: форматирование дат, валют, процентов и путей к загруженным файлам.
import { LOCALE_CODE_MAP } from "../i18n/config.js";
import { getMessage } from "../i18n/messages.js";

// Функция resolveLocale: определяет итоговое значение по входным данным.
const resolveLocale = (locale) => LOCALE_CODE_MAP[locale] || LOCALE_CODE_MAP.ru;

// Служебная функция currencyFormatter: инкапсулирует отдельный шаг логики этого модуля.
const currencyFormatter = (currency, locale) =>
  new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });

// Функция formatDate: форматирует данные для вывода в интерфейсе.
export const formatDate = (value, locale = "ru") =>
  new Intl.DateTimeFormat(resolveLocale(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

// Функция formatDateTime: форматирует данные для вывода в интерфейсе.
export const formatDateTime = (value, locale = "ru") =>
  new Intl.DateTimeFormat(resolveLocale(locale), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

// Функция formatCurrency: форматирует данные для вывода в интерфейсе.
export const formatCurrency = (value, currency = "KZT", locale = "ru") => {
  try {
    return currencyFormatter(currency, locale).format(Number(value));
  } catch {
    return `${value} ${currency.toUpperCase()}`;
  }
};

// Функция formatPercent: форматирует данные для вывода в интерфейсе.
export const formatPercent = (value) => `${Number(value || 0)}%`;

// Функция formatRole: форматирует данные для вывода в интерфейсе.
export const formatRole = (role, locale = "ru") =>
  getMessage(locale, `roles.${role}`) || role;

// Функция formatStatus: форматирует данные для вывода в интерфейсе.
export const formatStatus = (status, locale = "ru") =>
  getMessage(locale, `statuses.${status}`) || status;

// Функция formatPaymentMethod: форматирует данные для вывода в интерфейсе.
export const formatPaymentMethod = (method, locale = "ru") =>
  getMessage(locale, `paymentMethods.${method}`) || method;

// Функция formatGender: форматирует данные для вывода в интерфейсе.
export const formatGender = (gender, locale = "ru") => {
  if (!gender) {
    return getMessage(locale, "genders.UNKNOWN") || "";
  }

  return getMessage(locale, `genders.${gender}`) || gender;
};

// Функция resolveAssetUrl: определяет итоговое значение по входным данным.
export const resolveAssetUrl = (relativePath) => {
  if (!relativePath) {
    return null;
  }

  const apiUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";

  if (/^https?:\/\//.test(apiUrl)) {
    return `${new URL(apiUrl).origin}${relativePath}`;
  }

  return relativePath;
};

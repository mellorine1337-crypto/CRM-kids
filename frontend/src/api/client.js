import axios from "axios";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "../i18n/config.js";
import { getMessage } from "../i18n/messages.js";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../utils/token-storage.js";

const baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export const api = axios.create({
  baseURL,
});

let refreshPromise = null;
const AUTH_EXPIRED_KEY = "kids-crm.authExpired";

const getCurrentLocale = () =>
  localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;

const normalizeError = (error) => {
  const locale = getCurrentLocale();
  const validationMessage =
    error.response?.data?.message === "Validation error"
      ? error.response?.data?.details?.[0]?.message
      : null;
  const rawMessage =
    validationMessage ||
    error.response?.data?.message ||
    error.message ||
    "Something went wrong while calling the API";
  const message = getMessage(locale, `apiErrors.${rawMessage}`) || rawMessage;
  const normalized = new Error(message);
  normalized.response = error.response;
  normalized.details = error.response?.data?.details;
  return normalized;
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // При 401 клиент один раз пробует обновить access token через /auth/refresh, чтобы не выбрасывать пользователя из сессии при каждом истечении токена.
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      getRefreshToken() &&
      !originalRequest?.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          // Общий promise не даёт нескольким параллельным запросам одновременно отправить несколько refresh-вызовов.
          refreshPromise = axios
            .post(`${baseURL}/auth/refresh`, {
              refreshToken: getRefreshToken(),
            })
            .then(({ data }) => {
              setTokens(data.tokens);
              return data.tokens;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        await refreshPromise;
        return api(originalRequest);
      } catch {
        clearTokens();

        if (typeof window !== "undefined") {
          // Страница логина читает этот флаг и объясняет пользователю, почему сессия была сброшена.
          sessionStorage.setItem(AUTH_EXPIRED_KEY, "1");

          if (window.location.pathname !== "/login") {
            window.location.assign("/login");
          }
        }
      }
    }

    throw normalizeError(error);
  },
);

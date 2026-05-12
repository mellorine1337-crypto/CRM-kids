// Кратко: хранит состояние авторизации и методы входа, регистрации, logout и обновления профиля.
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "./auth-context.js";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../utils/token-storage.js";

// Провайдер AuthProvider: передаёт общее состояние и методы через context.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // При старте приложения пробуем восстановить пользователя по уже сохранённым токенам.
    // Это позволяет не выбрасывать человека на login после перезагрузки страницы.
    const bootstrap = async () => {
      if (!getAccessToken() && !getRefreshToken()) {
        setInitialized(true);
        return;
      }

      try {
        const { data } = await api.get("/users/me");
        setUser(data.user);
      } catch {
        clearTokens();
        setUser(null);
      } finally {
        setInitialized(true);
      }
    };

    bootstrap();
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialized,
      isAuthenticated: Boolean(user),
      // Методы ниже скрывают детали API от экранов: страница входа вызывает только login/register,
      // а обновление токенов и сохранение пользователя остаётся внутри auth-слоя.
      async loginAdmin(payload) {
        const { data } = await api.post("/auth/admin/login", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data.user;
      },
      async registerParent(payload) {
        const { data } = await api.post("/auth/parent/register", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data;
      },
      async loginParent(payload) {
        const { data } = await api.post("/auth/parent/login", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data;
      },
      async loginTeacher(payload) {
        const { data } = await api.post("/auth/teacher/login", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data;
      },
      async logout() {
        const refreshToken = getRefreshToken();

        try {
          if (refreshToken) {
            await api.post("/auth/logout", { refreshToken });
          }
        } catch {
          // Ошибку logout игнорируем: локальную сессию всё равно нужно очистить.
        } finally {
          clearTokens();
          setUser(null);
        }
      },
      async refreshProfile() {
        const { data } = await api.get("/users/me");
        setUser(data.user);
        return data.user;
      },
      async updateProfile(payload) {
        const { data } = await api.patch("/users/me", payload);
        setUser(data.user);
        return data.user;
      },
    }),
    [initialized, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

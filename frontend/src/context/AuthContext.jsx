import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { AuthContext } from "./auth-context.js";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "../utils/token-storage.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
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
      async login(payload) {
        const { data } = await api.post("/auth/login", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        const { data } = await api.post("/auth/register", payload);
        setTokens(data.tokens);
        setUser(data.user);
        return data.user;
      },
      async logout() {
        const refreshToken = getRefreshToken();

        try {
          if (refreshToken) {
            await api.post("/auth/logout", { refreshToken });
          }
        } catch {
          // ignore logout failures and clear the local session anyway
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

/**
 * AuthContext
 * Provides the currently logged-in user and auth helpers (login, register, logout)
 * to the entire component tree.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, LoginPayload, RegisterPayload } from '../types';
import * as authApi from '../api/authApi';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true while checking stored token

  // On mount: if tokens exist in localStorage, fetch the user profile
  useEffect(() => {
    const access = localStorage.getItem('access_token');
    if (!access) {
      setIsLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {
        // Token is invalid or expired and refresh also failed — clear everything
        localStorage.clear();
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authApi.login(payload);
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    // Fetch the user profile after storing tokens
    const me = await authApi.getMe();
    setUser(me);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await authApi.register(payload);
    localStorage.setItem('access_token', data.tokens.access);
    localStorage.setItem('refresh_token', data.tokens.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Even if the server call fails, clear the local state
      }
    }
    localStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — throws if used outside AuthProvider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

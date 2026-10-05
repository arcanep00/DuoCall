import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT access token ─────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = localStorage.getItem('access_token');
  if (access && config.headers) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ── Response interceptor — silent token refresh on 401 ───────────────────────
let isRefreshing = false;
let queue: Array<{ resolve: (token: string) => void; reject: (e: unknown) => void }> = [];

function drainQueue(err: unknown, token: string | null) {
  queue.forEach(({ resolve, reject }) => (err ? reject(err) : resolve(token!)));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const orig = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401, once per request
    if (error.response?.status !== 401 || orig._retry) {
      return Promise.reject(error);
    }

    orig._retry = true;

    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) {
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another request is already refreshing — queue this one
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        if (orig.headers) orig.headers.Authorization = `Bearer ${token}`;
        return api(orig);
      });
    }

    isRefreshing = true;
    try {
      // Use plain axios (not `api`) to avoid interceptor loop
      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } },
      );
      const newAccess: string = data.access;
      const newRefresh: string | undefined = data.refresh;

      localStorage.setItem('access_token', newAccess);
      if (newRefresh) localStorage.setItem('refresh_token', newRefresh);

      drainQueue(null, newAccess);
      if (orig.headers) orig.headers.Authorization = `Bearer ${newAccess}`;
      return api(orig);
    } catch (refreshErr) {
      drainQueue(refreshErr, null);
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

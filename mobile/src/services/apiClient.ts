import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { authEvents } from '@/utils/authEvents';
import { secureStorage } from '@/utils/secureStorage';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: { 'Content-Type': 'application/json' },
});

// Separate instance for the token refresh call so it never recurses into
// the interceptor below (which would attempt to refresh on its own 401).
const refreshClient = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
});

apiClient.interceptors.request.use(async (config) => {
  const accessToken = await secureStorage.getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const fullUrl = (config.baseURL ?? '') + (config.url ?? '');
  console.log(`[http] → ${config.method?.toUpperCase()} ${fullUrl}`);
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await refreshClient.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken },
    );
    await secureStorage.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    // A 401 on the login route means wrong credentials, not an expired token —
    // skip the refresh cycle entirely and let the error surface to the component.
    const isAuthRoute = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retried || isAuthRoute) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      await secureStorage.clearTokens();
      authEvents.emit('unauthorized');
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return apiClient(originalRequest);
  },
);

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { API_TIMEOUT_MS, API_URL } from './config';
import { applyScopeRules } from './scope';
import { tokens } from './tokens';

/**
 * Mobile version of the web app's SuperAdmin_axios: same backend, same rules.
 * - Bearer token on every call except login / refresh
 * - 401 → one refresh attempt with the refresh token, then retry
 * - 401 "signed out" → session ended on another device → sign out
 * - 403 "password change required" → show the change-password screen
 * - Super Admin company scope: X-Company-Id header + scope keys stripped (lib/scope.ts)
 * - 400 "select a company" → open the company picker (Super Admin)
 */
export const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

/** The session store registers these so the API layer does not import it (avoids a cycle). */
type Handlers = { onSignedOut: () => void; onPasswordChangeRequired: () => void; onNeedCompany?: () => void };
let handlers: Handlers = { onSignedOut: () => {}, onPasswordChangeRequired: () => {}, onNeedCompany: () => {} };
export function setApiHandlers(h: Handlers) {
  handlers = h;
}

const isAuthUrl = (url = '') => /\/auth\/(login|refresh|super-admins\/login)/.test(url);

api.interceptors.request.use((config) => {
  const token = tokens.getAccess();
  if (token && !isAuthUrl(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Company isolation: Super Admin sends X-Company-Id once a company is picked; everyone else sends no scope.
  return applyScopeRules(config);
});

/** Shared refresh so several 401s at once trigger only one refresh call. */
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');
  const { data } = await axios.post(
    `${API_URL}/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: API_TIMEOUT_MS },
  );
  if (!data?.access_token) throw new Error('Refresh response has no access token');
  await tokens.set(data);
  return data.access_token;
}

export function errorDetail(error: unknown): string {
  const e = error as AxiosError<{ detail?: unknown }>;
  const detail = e.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(', ');
  return detail ? JSON.stringify(detail) : '';
}

/** A message that can be shown to the user. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as AxiosError;
  if (!e.response) return 'Cannot reach the server. Check your connection and try again.';
  const userMessage = (e as AxiosError & { userMessage?: string }).userMessage;
  return userMessage || errorDetail(error) || fallback;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const detail = errorDetail(error);

    if (status === 401 && /signed out/i.test(detail)) {
      handlers.onSignedOut();
      return Promise.reject(error);
    }
    if (status === 403 && /password change required/i.test(detail)) {
      handlers.onPasswordChangeRequired();
      return Promise.reject(error);
    }
    // Super Admin acted on a company screen without a company: open the picker.
    if (status === 400 && /select a company/i.test(detail)) {
      (error as AxiosError & { userMessage?: string }).userMessage = 'Select a company first';
      handlers.onNeedCompany?.();
      return Promise.reject(error);
    }
    if (status !== 401 || !request || request._retry || isAuthUrl(request.url) || !tokens.getRefresh()) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      request.headers.Authorization = `Bearer ${newToken}`;
      return api(request);
    } catch (refreshError) {
      handlers.onSignedOut();
      return Promise.reject(refreshError);
    }
  },
);

/**
 * @layer Dashboard (UI-only)
 * This module must never access filesystem or child_process.
 * All mutations occur via REST APIs exposed by service/server.ts.
 */
import { SERVICE_URL } from '../utils/constants';
import { useDashboardStore } from '../store/useDashboardStore';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const { token } = useDashboardStore.getState();
  const headers: Record<string, string> = {
    'X-Deemind-Source': 'dashboard',
    ...((options.headers as Record<string, string>) || {}),
  };
  const method = (options.method ? String(options.method) : 'GET').toUpperCase();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  let currentMode = 'friendly';
  if (typeof window !== 'undefined') {
    currentMode =
      (window as any).__DEEMIND_MODE__ ||
      window.localStorage.getItem('deemindMode') ||
      'friendly';
  }
  headers['X-Deemind-Mode'] = currentMode;
  const targetUrl = path.startsWith('http') ? path : `${SERVICE_URL}${path}`;
  let normalizedPath = path;
  try {
    normalizedPath = new URL(targetUrl).pathname;
  } catch {
    normalizedPath = path;
  }
  if (method !== 'GET' && normalizedPath.startsWith('/output')) {
    throw new Error('Dashboard cannot mutate /output/* — use service APIs.');
  }
  const res = await fetch(targetUrl, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res;
}

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  return res.json() as Promise<T>;
}

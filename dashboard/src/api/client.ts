import { SERVICE_URL } from '../utils/constants';
import { useDashboardStore } from '../store/useDashboardStore';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const { token } = useDashboardStore.getState();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof window !== 'undefined') {
    const mode = window.localStorage.getItem('deemindMode');
    if (mode) headers['X-Deemind-Mode'] = mode;
  }
  const res = await fetch(`${SERVICE_URL}${path}`, { ...options, headers });
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

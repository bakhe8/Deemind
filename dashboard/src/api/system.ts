import { apiFetch, apiJson } from './client';
import type { StatusResponse } from '../store/useDashboardStore';

export type StoreDemo = { id: string; name: string; meta: Record<string, any>; partials: string[] };
export type TwilightConfig = { enabled: boolean };

export async function fetchStatus() {
  return apiJson<StatusResponse>('/api/status');
}

export async function fetchReportsList() {
  return apiJson<any[]>('/api/reports');
}

export async function fetchOutputs() {
  return apiJson<any[]>('/api/outputs');
}

export async function fetchBaselineLogs() {
  return apiJson<{ logs: any[] }>('/api/baseline/logs');
}

export async function fetchBaselineMetrics() {
  return apiJson<{ metrics: any[] }>('/api/baseline/metrics');
}

export async function fetchSettings() {
  return apiJson<Record<string, any>>('/api/settings');
}

export async function updateBaselineList(baselines: string[]) {
  return apiJson('/api/settings/baseline', {
    method: 'PUT',
    body: JSON.stringify({ baselines }),
  });
}

export async function fetchLogHistory() {
  return apiJson<string[]>('/api/log/history');
}

export async function fetchStubStatus() {
  return apiJson<{ running: boolean; theme: string | null; port: number }>('/api/preview/stub');
}

export async function fetchStubLogs() {
  return apiJson<{ logs: string[] }>('/api/preview/stub/logs');
}

export async function startStub(theme: string) {
  return apiFetch('/api/preview/stub', {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function stopStub() {
  return apiFetch('/api/preview/stub', { method: 'DELETE' });
}

export async function resetStubState(theme?: string) {
  const body = theme ? { theme } : {};
  return apiJson<{ success: boolean; theme: string; inPlace: boolean }>('/api/preview/stub/reset', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchStoreDemos() {
  return apiJson<{ demos: StoreDemo[] }>('/api/store/demos');
}

export async function applyStorePreset(payload: { demo: string; theme?: string; overrides?: Record<string, any>; parts?: string[] }) {
  return apiJson('/api/store/preset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function previewStoreComposition(demo: string, parts?: string[]) {
  const params = new URLSearchParams();
  params.set('demo', demo);
  if (parts?.length) {
    params.set('parts', parts.join(','));
  }
  return apiJson(`/api/store/compose?${params.toString()}`);
}

export async function fetchStoreDiff(params: { demo: string; theme?: string }) {
  const query = new URLSearchParams();
  query.set('demo', params.demo);
  if (params.theme) query.set('theme', params.theme);
  return apiJson(`/api/store/diff?${query.toString()}`);
}

export async function fetchTwilightStatus() {
  return apiJson<TwilightConfig>('/api/twilight');
}

export async function updateTwilightStatus(enabled: boolean) {
  return apiJson<TwilightConfig>('/api/twilight', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function fetchRuntimeAnalytics(limit = 40) {
  return apiJson<{ entries: any[] }>(`/api/runtime/analytics?limit=${limit}`);
}

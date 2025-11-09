import { apiFetch, apiJson } from './client';
import type { StatusResponse } from '../store/useDashboardStore';
import type { JobStatus, OutputEntry, ReportSummary, RunRequest } from '../lib/contracts';

export type StoreDemo = { id: string; name: string; meta: Record<string, any>; partials: string[] };
export type StorePartial = { id: string; version?: string | null; key: string; label: string; category?: string | null; path: string };
export type TwilightConfig = { enabled: boolean };
export type RuntimeStubInfo = { theme: string; port: number; running: boolean; logs?: string[] };

export async function fetchStatus() {
  return apiJson<StatusResponse>('/api/status');
}

export async function fetchReportsList() {
  return apiJson<ReportSummary[]>('/api/reports');
}

export async function fetchOutputs() {
  return apiJson<OutputEntry[]>('/api/outputs');
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

export async function fetchStubStatus(theme?: string) {
  const params = new URLSearchParams();
  if (theme) params.set('theme', theme);
  const query = params.toString();
  return apiJson<{ running: boolean; theme: string | null; port: number }>(
    `/api/preview/stub${query ? `?${query}` : ''}`,
  );
}

export async function fetchStubLogs(theme?: string) {
  const params = new URLSearchParams();
  if (theme) params.set('theme', theme);
  const query = params.toString();
  return apiJson<{ theme: string | null; logs: string[] }>(`/api/preview/stub/logs${query ? `?${query}` : ''}`);
}

export async function startStub(theme: string) {
  return apiFetch('/api/preview/stub', {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function stopStub(theme?: string) {
  const options: RequestInit = { method: 'DELETE' };
  if (theme) {
    options.body = JSON.stringify({ theme });
  }
  return apiFetch('/api/preview/stub', options);
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

export async function fetchStorePartials() {
  return apiJson<{ partials: StorePartial[] }>('/api/store/partials');
}

export async function fetchStubList() {
  return apiJson<{ stubs: RuntimeStubInfo[] }>('/api/preview/stubs');
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

export async function fetchStoreDiff(params: { demo: string; theme?: string; parts?: string[] }) {
  const query = new URLSearchParams();
  query.set('demo', params.demo);
  if (params.theme) query.set('theme', params.theme);
  if (params.parts?.length) query.set('parts', params.parts.join(','));
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

export async function fetchRuntimeAnalytics(limit = 40, theme?: string) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (theme) params.set('theme', theme);
  return apiJson<{ entries: any[] }>(`/api/runtime/analytics?${params.toString()}`);
}

export async function fetchScenarioRuns(limit = 10) {
  return apiJson<{ runs: any[] }>(`/api/runtime/scenarios?limit=${limit}`);
}

export async function runRuntimeScenario(payload: { theme: string; chain?: string[] }) {
  return apiJson<{ enqueued: boolean; id: string }>(`/api/runtime/scenario`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchRuntimeState(theme: string) {
  const params = new URLSearchParams();
  params.set('theme', theme);
  return apiJson<{ theme: string; state: any }>(`/api/runtime/state?${params.toString()}`);
}

export async function fetchRuntimeContext(theme: string) {
  const params = new URLSearchParams();
  params.set('theme', theme);
  return apiJson<{ theme: string; source: string; context: any }>(`/api/runtime/context?${params.toString()}`);
}

export async function regenerateRuntimeContext(payload: { theme: string; demo?: string }) {
  return apiJson<{ success: boolean; theme: string; demo: string; context: any }>(`/api/runtime/context`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRuntimeLocale(payload: { theme: string; language: string }) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/locale`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearRuntimeCart(theme: string) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/cart/clear`, {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function removeRuntimeCartItem(payload: { theme: string; id: number }) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/cart/remove`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearRuntimeWishlist(theme: string) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/wishlist/clear`, {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function removeRuntimeWishlistItem(payload: { theme: string; id: number }) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/wishlist/remove`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function logoutRuntimeUser(theme: string) {
  return apiJson<{ success: boolean; state: any }>(`/api/runtime/session/logout`, {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
}

export async function fetchScenarioFlows() {
  return apiJson<{ flows: Array<{ id: string; label: string }> }>('/api/runtime/scenario/flows');
}

export async function fetchScenarioSessions() {
  return apiJson<{ sessions: any[] }>('/api/runtime/scenario/sessions');
}

export async function fetchScenarioDetail(id: string) {
  return apiJson<{ id: string; session: any; log: any }>(`/api/runtime/scenarios/${encodeURIComponent(id)}`);
}

export async function triggerRunJob(payload: RunRequest) {
  return apiJson<JobStatus>('/api/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchRunJobs() {
  return apiJson<{ jobs: JobStatus[] }>('/api/run/jobs');
}

export async function fetchRunJob(id: string) {
  return apiJson<JobStatus>(`/api/run/jobs/${encodeURIComponent(id)}`);
}

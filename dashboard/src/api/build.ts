/**
 * @layer Dashboard (UI-only)
 * This module must never access filesystem or child_process.
 * All mutations occur via REST APIs exposed by service/server.ts.
 */
import { apiFetch, apiJson } from './client';

export type BuildSession = {
  id: string;
  theme: string;
  diff: boolean;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  source: string;
  exitCode: number | null;
  metrics?: {
    errors: number;
    warnings: number;
  } | null;
};

export async function startBuild(payload: { theme: string; diff?: boolean }) {
  return apiJson<{ enqueued: boolean; session: BuildSession }>('/api/build/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBuildSessions() {
  return apiJson<{ sessions: BuildSession[] }>('/api/build/sessions');
}

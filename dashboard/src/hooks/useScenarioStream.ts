import { useEffect, useState } from 'react';
import { fetchScenarioSessions } from '../api/system';
import { useDashboardStore } from '../store/useDashboardStore';
import { SERVICE_URL } from '../utils/constants';

export type ScenarioSession = {
  id: string;
  theme: string;
  chain: string[];
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  source: string;
  logFile?: string | null;
  exitCode: number | null;
};

export function useScenarioStream() {
  const [sessions, setSessions] = useState<ScenarioSession[]>([]);
  const token = useDashboardStore((state) => state.token);

  useEffect(() => {
    fetchScenarioSessions()
      .then((res) => setSessions(res.sessions || []))
      .catch(() => undefined);

    const url = new URL('/api/runtime/scenario/stream', SERVICE_URL);
    if (token) {
      url.searchParams.set('token', token);
    }
    const source = new EventSource(url.toString());
    source.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const snapshot = Array.isArray(payload.sessions) ? payload.sessions : [];
        setSessions(snapshot);
      } catch {
        // ignore
      }
    });
    source.addEventListener('status', (event) => {
      try {
        const session = JSON.parse(event.data || '{}');
        if (!session?.id) return;
        setSessions((prev) => {
          const idx = prev.findIndex((entry) => entry.id === session.id);
          if (idx === -1) {
            return [session, ...prev].slice(0, 20);
          }
          const next = [...prev];
          next[idx] = { ...next[idx], ...session };
          return next;
        });
      } catch {
        // ignore
      }
    });
    return () => {
      source.close();
    };
  }, [token]);

  return { sessions };
}

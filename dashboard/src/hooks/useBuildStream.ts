import { useEffect, useState } from 'react';
import { fetchBuildSessions, type BuildSession } from '../api';
import { useDashboardStore } from '../store/useDashboardStore';
import { SERVICE_URL } from '../utils/constants';

type LogsMap = Record<string, string[]>;

function upsertSession(list: BuildSession[], session: BuildSession) {
  const idx = list.findIndex((entry) => entry.id === session.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...session };
    return next;
  }
  return [session, ...list].slice(0, 15);
}

export function useBuildStream() {
  const [sessions, setSessions] = useState<BuildSession[]>([]);
  const [logs, setLogs] = useState<LogsMap>({});
  const token = useDashboardStore((state) => state.token);

  useEffect(() => {
    fetchBuildSessions()
      .then((res) => {
        const snapshot = res.sessions || [];
        setSessions(snapshot);
        const initialLogs: LogsMap = {};
        snapshot.forEach((session) => {
          initialLogs[session.id] = session.logs || [];
        });
        setLogs(initialLogs);
      })
      .catch(() => undefined);

    const url = new URL('/api/build/stream', SERVICE_URL);
    if (token) {
      url.searchParams.set('token', token);
    }
    const source = new EventSource(url.toString());
    source.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const snapshot = Array.isArray(payload.sessions) ? payload.sessions : [];
        setSessions(snapshot);
        const nextLogs: LogsMap = {};
        snapshot.forEach((session: BuildSession) => {
          nextLogs[session.id] = session.logs || [];
        });
        setLogs(nextLogs);
      } catch {
        // ignore
      }
    });
    source.addEventListener('status', (event) => {
      try {
        const session = JSON.parse(event.data || '{}');
        setSessions((prev) => upsertSession(prev, session));
        if (Array.isArray(session.logs)) {
          setLogs((prev) => ({ ...prev, [session.id]: session.logs }));
        }
      } catch {
        // ignore malformed payloads
      }
    });
    source.addEventListener('log', (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const id = payload.id;
        if (!id) return;
        setLogs((prev) => {
          const next = { ...prev };
          const entries = next[id] ? [...next[id]] : [];
          if (typeof payload.line === 'string') {
            entries.push(payload.line);
            if (entries.length > 400) entries.shift();
          }
          next[id] = entries;
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

  const getLogs = (id?: string | null) => {
    if (!id) return [];
    return logs[id] || [];
  };

  return { sessions, getLogs };
}

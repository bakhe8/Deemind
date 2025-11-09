import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { fetchLogHistory } from '../api/system';
import { SERVICE_URL } from '../utils/constants';

export default function LogViewer() {
  const token = useDashboardStore((state) => state.token);
  const logLines = useDashboardStore((state) => state.logLines);
  const setLogLines = useDashboardStore((state) => state.setLogLines);
  const supportsSSE = useMemo(
    () => typeof window !== 'undefined' && typeof window.EventSource !== 'undefined',
    [],
  );
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchLogHistory()
      .then((lines) => {
        if (!mounted) return;
        setLogLines(Array.isArray(lines) ? lines : []);
        setStreamError(null);
      })
      .catch(() => {
        if (mounted) {
          setStreamError('Unable to load log history. Waiting for service…');
        }
      });

    if (!supportsSSE) {
      return () => {
        mounted = false;
      };
    }

    const url = new URL('/api/log/stream', SERVICE_URL);
    if (token) url.searchParams.set('token', token);
    const source = new EventSource(url.toString());
    source.onmessage = (event) => {
      setLogLines((prev) => {
        const next = [...prev.slice(-200), event.data];
        return next;
      });
      setStreamError(null);
    };
    source.onerror = () => {
      setStreamError('Live log stream disconnected. Retrying automatically…');
      source.close();
    };

    return () => {
      mounted = false;
      source.close();
    };
  }, [token, setLogLines, supportsSSE]);

  return (
    <div className="bg-slate-900 text-slate-50 rounded-2xl p-4 font-mono text-xs h-64 overflow-y-auto shadow-inner space-y-1">
      {!supportsSSE && (
        <p className="text-amber-200 text-[11px] font-semibold">
          Live log streaming requires EventSource support. Showing last captured log snapshot.
        </p>
      )}
      {streamError && (
        <p className="text-amber-200 text-[11px] font-semibold">{streamError}</p>
      )}
      {logLines.length === 0 ? (
        <p className="text-slate-400">No logs yet. Trigger a CLI task to start streaming output.</p>
      ) : (
        logLines
          .slice()
          .reverse()
          .map((line, idx) => (
            <div key={`${line}-${idx}`}>{line}</div>
          ))
      )}
    </div>
  );
}

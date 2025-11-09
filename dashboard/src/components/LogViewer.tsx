import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { fetchLogHistory } from '../api/system';
import { SERVICE_URL } from '../utils/constants';
import {
  formatServiceLogEntry,
  getLogLevelLabel,
  getLogStage,
  normalizeLogEntries,
  parseLogStreamPayload,
} from '../lib/serviceLogs';

const levelBadgeClass = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'error':
      return 'bg-rose-500/20 text-rose-100 border border-rose-400/50';
    case 'warn':
    case 'warning':
      return 'bg-amber-500/20 text-amber-100 border border-amber-400/40';
    case 'debug':
    case 'trace':
      return 'bg-sky-500/15 text-sky-100 border border-sky-400/30';
    default:
      return 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30';
  }
};

const stageBadgeClass = 'bg-slate-800 text-slate-200 border border-slate-700';
const badgeBaseClass =
  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

const formatTimestamp = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour12: false }) || '';

const MAX_LOG_LINES = 200;

export default function LogViewer() {
  const token = useDashboardStore((state) => state.token);
  const logLines = useDashboardStore((state) => state.logLines);
  const setLogLines = useDashboardStore((state) => state.setLogLines);
  const supportsSSE = useMemo(
    () => typeof window !== 'undefined' && typeof window.EventSource !== 'undefined',
    [],
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const renderedEntries = useMemo(() => normalizeLogEntries(logLines), [logLines]);

  useEffect(() => {
    let mounted = true;
    fetchLogHistory()
      .then((lines) => {
        if (!mounted) return;
        const normalized = Array.isArray(lines) ? normalizeLogEntries(lines) : [];
        setLogLines(normalized.slice(-MAX_LOG_LINES));
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
      const entry = parseLogStreamPayload(event.data);
      if (!entry) return;
      setLogLines((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), entry]);
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
      {renderedEntries.length === 0 ? (
        <p className="text-slate-400">No logs yet. Trigger a CLI task to start streaming output.</p>
      ) : (
        renderedEntries
          .slice()
          .reverse()
          .map((entry, idx) => {
            const stageLabel = getLogStage(entry);
            return (
              <div
                key={`${entry.ts}-${idx}`}
                className="space-y-1 border-b border-slate-800 pb-2 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-mono text-[10px] text-slate-500">
                    {formatTimestamp(entry.ts)}
                  </span>
                  <span className={`${badgeBaseClass} ${levelBadgeClass(entry.level)}`}>
                    {getLogLevelLabel(entry.level)}
                  </span>
                  {stageLabel && (
                    <span className={`${badgeBaseClass} ${stageBadgeClass}`}>{stageLabel}</span>
                  )}
                </div>
                <div className="whitespace-pre-wrap break-words text-slate-100">
                  {formatServiceLogEntry(entry, { includeStage: false })}
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}

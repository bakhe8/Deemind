import { useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { fetchLogHistory } from '../api/system';
import { SERVICE_URL } from '../utils/constants';

export default function LogViewer() {
  const { token, logLines, setLogLines } = useDashboardStore((state) => ({
    token: state.token,
    logLines: state.logLines,
    setLogLines: state.setLogLines,
  }));

  useEffect(() => {
    fetchLogHistory().then(setLogLines).catch(() => undefined);
    let source: EventSource | null = null;
    const url = new URL('/api/log/stream', SERVICE_URL);
    if (token) url.searchParams.set('token', token);
    source = new EventSource(url.toString());
    source.onmessage = (event) => {
      setLogLines((prev) => [...prev.slice(-200), event.data]);
    };
    source.onerror = () => {
      source?.close();
    };
    return () => source?.close();
  }, [token, setLogLines]);

  return (
    <div className="bg-slate-900 text-slate-50 rounded-2xl p-4 font-mono text-xs h-64 overflow-y-auto shadow-inner">
      {logLines.slice().reverse().map((line, idx) => (
        <div key={`${line}-${idx}`}>{line}</div>
      ))}
    </div>
  );
}

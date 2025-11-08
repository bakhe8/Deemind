import { useEffect, useMemo, useState } from 'react';

const SERVICE_URL = (import.meta.env.VITE_SERVICE_URL as string) || (globalThis as any).__SERVICE_URL__ || 'http://localhost:5757';

type StatusResponse = {
  current: { label: string } | null;
  queue: Array<{ label: string }>;
};

type ReportEntry = {
  name: string;
  size: number;
  modified: string;
  url: string;
};

type OutputEntry = {
  name: string;
  type: 'theme' | 'file';
  size: number;
  modified: string;
  manifestUrl: string | null;
  reportUrl: string | null;
  browseUrl: string;
};

export default function App() {
  const [status, setStatus] = useState<StatusResponse>({ current: null, queue: [] });
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [outputs, setOutputs] = useState<OutputEntry[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const withTokenParam = (path: string) => {
    const url = new URL(path, SERVICE_URL);
    if (token) url.searchParams.set('token', token);
    return url.toString();
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  async function refresh() {
    setError(null);
    try {
      const [statusRes, reportsRes, outputsRes] = await Promise.all([
        fetch(`${SERVICE_URL}/api/status`, { headers }),
        fetch(`${SERVICE_URL}/api/reports`, { headers }),
        fetch(`${SERVICE_URL}/api/outputs`, { headers }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (reportsRes.ok) setReports(await reportsRes.json());
      if (outputsRes.ok) setOutputs(await outputsRes.json());
      await loadLogHistory();
    } catch (err: any) {
      setError(err?.message || 'Unable to reach service');
    }
  }

  async function runTask(task: string) {
    setTaskLoading(true);
    try {
      const res = await fetch(`${SERVICE_URL}/api/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task }),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Failed to enqueue: ${text}`);
      } else {
        refresh();
      }
    } finally {
      setTaskLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [headers]);

  const loadLogHistory = async () => {
    try {
      const res = await fetch(withTokenParam('/api/log/history'), { headers });
      if (res.ok) {
        setLogLines(await res.json());
      }
    } catch {
      // ignore failures, SSE will update once connected
    }
  };

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (source) {
        source.close();
        source = null;
      }
      const streamUrl = withTokenParam('/api/log/stream');
      source = new EventSource(streamUrl);
      source.onmessage = (event) => {
        setLogLines((prev) => [...prev.slice(-200), event.data]);
        setError(null);
      };
      source.onerror = () => {
        setError('Lost connection to log stream. Retrying…');
        if (!retryTimer) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            connect();
          }, 5000);
        }
      };
    };

    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (source) source.close();
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="uppercase tracking-[0.4em] text-xs text-slate-500">Deemind Service</p>
            <h1 className="text-2xl font-semibold">Local Dashboard</h1>
          </div>
          <input
            type="password"
            placeholder="Token (optional)"
            className="border rounded px-3 py-1 text-sm"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded">
            {error}
          </div>
        )}
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-3">Run Tasks</h2>
          <div className="flex flex-wrap gap-3">
            <button disabled={taskLoading} onClick={() => runTask('build-all')} className="btn-primary">
              Build All (Autopilot)
            </button>
            <button disabled={taskLoading} onClick={() => runTask('build-demo')} className="btn-secondary">
              Build Demo
            </button>
            <button disabled={taskLoading} onClick={() => runTask('validate')} className="btn-secondary">
              Validate
            </button>
            <button disabled={taskLoading} onClick={() => runTask('doctor')} className="btn-secondary">
              Doctor
            </button>
            <button onClick={refresh} className="btn-ghost">
              Refresh Status
            </button>
          </div>
          <div className="mt-4 flex gap-6 text-sm text-slate-500">
            <div>
              <p className="text-xs uppercase tracking-wide">Current Task</p>
              <p className="text-base text-slate-900">{status.current?.label || 'Idle'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide">Queue</p>
              <p>{status.queue.map((q) => q.label).join(', ') || 'Empty'}</p>
            </div>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold mb-3">Reports</h2>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {reports.length === 0 && <p className="text-sm text-slate-500">No reports yet.</p>}
              {reports.map((r) => (
                <li key={r.name} className="text-sm flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(r.size)} • {formatDate(r.modified)}
                    </p>
                  </div>
                  <a className="text-primary underline" href={withTokenParam(r.url)} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold mb-3">Outputs</h2>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {outputs.length === 0 && <p className="text-sm text-slate-500">No themes generated yet.</p>}
              {outputs.map((o) => (
                <li key={o.name} className="text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        {o.name} <span className="text-xs uppercase text-slate-400">({o.type})</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(o.modified)}
                        {o.manifestUrl && ' • manifest'}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {o.manifestUrl && (
                        <a className="text-primary underline" href={withTokenParam(o.manifestUrl)} target="_blank" rel="noreferrer">
                          Manifest
                        </a>
                      )}
                      {o.reportUrl && (
                        <a className="text-primary underline" href={withTokenParam(o.reportUrl)} target="_blank" rel="noreferrer">
                          Report
                        </a>
                      )}
                      <a className="text-primary underline" href={withTokenParam(o.browseUrl)} target="_blank" rel="noreferrer">
                        Browse
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold mb-3">Logs</h2>
          <div className="bg-slate-900 text-slate-50 rounded p-4 text-sm max-h-80 overflow-auto font-mono">
            {logLines.slice().reverse().map((line, idx) => (
              <div key={`${line}-${idx}`}>{line}</div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

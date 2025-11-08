import { useEffect, useMemo, useState } from 'react';

const SERVICE_URL = (import.meta.env.VITE_SERVICE_URL as string) || (globalThis as any).__SERVICE_URL__ || 'http://localhost:5757';

type StatusResponse = {
  current: { label: string } | null;
  queue: Array<{ label: string }>;
};

export default function App() {
  const [status, setStatus] = useState<StatusResponse>({ current: null, queue: [] });
  const [reports, setReports] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [token, setToken] = useState<string>('');

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  async function refresh() {
    const [statusRes, reportsRes, outputsRes] = await Promise.all([
      fetch(`${SERVICE_URL}/api/status`, { headers }),
      fetch(`${SERVICE_URL}/api/reports`, { headers }),
      fetch(`${SERVICE_URL}/api/outputs`, { headers }),
    ]);
    if (statusRes.ok) setStatus(await statusRes.json());
    if (reportsRes.ok) setReports(await reportsRes.json());
    if (outputsRes.ok) setOutputs(await outputsRes.json());
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
  }, [headers]);

  useEffect(() => {
    const source = new EventSource(`${SERVICE_URL}/api/log/stream`);
    source.onmessage = (event) => {
      setLogLines((prev) => [...prev.slice(-200), event.data]);
    };
    return () => source.close();
  }, []);

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
              {reports.map((r) => (
                <li key={r} className="text-sm">
                  <a className="text-primary underline" href={`../reports/${r}`} target="_blank" rel="noreferrer">
                    {r}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="text-lg font-semibold mb-3">Outputs</h2>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {outputs.map((o) => (
                <li key={o} className="text-sm flex justify-between">
                  <span>{o}</span>
                  <a className="text-primary underline" href={`../output/${o}`} target="_blank" rel="noreferrer">
                    View
                  </a>
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

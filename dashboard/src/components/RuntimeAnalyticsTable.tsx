import { useEffect, useState } from 'react';
import { fetchRuntimeAnalytics } from '../api/system';

type AnalyticsEntry = {
  ts: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  preset?: string | null;
  theme?: string | null;
};

type Props = {
  theme?: string;
  limit?: number;
};

export default function RuntimeAnalyticsTable({ theme, limit = 40 }: Props) {
  const [entries, setEntries] = useState<AnalyticsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchRuntimeAnalytics(limit, theme);
      setEntries(res.entries || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [theme, limit]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Runtime API Metrics</h2>
          <p className="text-xs text-slate-500">
            Last {entries.length} API calls
            {theme ? ` for ${theme}` : ''} captured by the preview stub.
          </p>
        </div>
        <button className="btn-ghost text-xs" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {!entries.length ? (
        <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No analytics yet.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="text-slate-500 text-left">
              <tr>
                <th className="py-2 pr-3">Time</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Path</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Duration (ms)</th>
                <th className="py-2 pr-3">Preset</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={`${entry.ts}-${idx}`} className="border-t border-slate-100 text-slate-700">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(entry.ts).toLocaleTimeString()}</td>
                  <td className="py-2 pr-3">{entry.method}</td>
                  <td className="py-2 pr-3 font-mono">{entry.path}</td>
                  <td className="py-2 pr-3">{entry.status}</td>
                  <td className="py-2 pr-3">{entry.duration}</td>
                  <td className="py-2 pr-3">{entry.preset || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

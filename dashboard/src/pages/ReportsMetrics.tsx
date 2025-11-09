import { useEffect, useMemo, useState } from 'react';
import BaselineBarChart from '../components/charts/BaselineBarChart';
import { fetchBaselineLogs, fetchBaselineMetrics } from '../api/system';
import RuntimeEventFeed from '../components/RuntimeEventFeed';
import RuntimeAnalyticsTable from '../components/RuntimeAnalyticsTable';
import { usePreviewMatrix } from '../hooks/usePreviewMatrix';

export default function ReportsMetrics() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [runtimeTheme, setRuntimeTheme] = useState('');
  const {
    entries: previewEntries,
    loading: previewMatrixLoading,
    refresh: refreshPreviewMatrix,
  } = usePreviewMatrix({ pollMs: 30000 });

  useEffect(() => {
    fetchBaselineMetrics().then((res) => setMetrics(res.metrics)).catch(() => undefined);
    fetchBaselineLogs().then((res) => setLogs(res.logs)).catch(() => undefined);
  }, []);

  const coverageStats = useMemo(() => {
    const ready = previewEntries.filter((entry) => entry.pages.length && entry.status === 'ready');
    const missing = previewEntries.filter(
      (entry) => !entry.pages.length || entry.status === 'missing' || entry.missing,
    );
    const total = previewEntries.length;
    const percent = total ? Math.round((ready.length / total) * 100) : 0;
    return {
      readyCount: ready.length,
      missingCount: missing.length,
      total,
      percent,
      missingList: missing.slice(0, 5),
    };
  }, [previewEntries]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Runtime Filters</h2>
            <p className="text-xs text-slate-500">Set a theme to scope analytics and live events.</p>
          </div>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="demo"
            value={runtimeTheme}
            onChange={(e) => setRuntimeTheme(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Leave blank to inspect all runtime traffic across themes.
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Snapshot Coverage</h2>
            <p className="text-xs text-slate-500">Same matrix that powers Preview Manager, surfaced here for ops.</p>
          </div>
          <button
            className="btn-ghost text-xs"
            onClick={refreshPreviewMatrix}
            disabled={previewMatrixLoading}
          >
            {previewMatrixLoading ? 'Refreshing…' : 'Refresh coverage'}
          </button>
        </div>
        {coverageStats.total === 0 ? (
          <p className="text-xs text-slate-500">No snapshot data detected yet. Run Preview Manager to seed coverage.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 uppercase">Ready Themes</p>
              <p className="text-2xl font-semibold text-emerald-600">{coverageStats.readyCount}</p>
              <p className="text-xs text-slate-500">Out of {coverageStats.total} tracked themes.</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase">Missing Snapshots</p>
              {coverageStats.missingCount ? (
                <div className="flex flex-wrap gap-1">
                  {coverageStats.missingList.map((entry) => (
                    <span key={entry.theme} className="px-2 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px]">
                      {entry.theme}
                    </span>
                  ))}
                  {coverageStats.missingCount > coverageStats.missingList.length && (
                    <span className="text-[11px] text-slate-500">
                      +{coverageStats.missingCount - coverageStats.missingList.length} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">All themes have snapshots.</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase">Readiness</p>
              <div className="h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${coverageStats.percent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">{coverageStats.percent}% of tracked themes are snapshot-ready.</p>
            </div>
          </div>
        )}
      </div>
      <RuntimeAnalyticsTable theme={runtimeTheme || undefined} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Baseline Metrics</h2>
        <BaselineBarChart data={metrics.slice(-8)} />
      </div>
      <RuntimeEventFeed title="Live Runtime Events" limit={8} theme={runtimeTheme || undefined} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Recent Baseline Logs</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Theme</th>
                <th>Baseline</th>
                <th>Added</th>
                <th>Skipped</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 10).map((log) => (
                <tr key={log.timestamp} className="border-t border-slate-100">
                  <td className="py-2">{log.theme}</td>
                  <td>{log.baseline}</td>
                  <td>{log.added?.length || 0}</td>
                  <td>{log.skipped?.length || 0}</td>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


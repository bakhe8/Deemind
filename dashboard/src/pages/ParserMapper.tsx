import { useEffect, useState } from 'react';
import StatsCard from '../components/StatsCard';
import LogViewer from '../components/LogViewer';
import { fetchStatus, fetchReportsList } from '../api';
import StubStatusCard from '../components/StubStatusCard';
import type { StatusResponse } from '../store/useDashboardStore';

export default function ParserMapper() {
  const [status, setStatus] = useState<StatusResponse>({ current: null, queue: [] });
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const [statusRes, reportsRes] = await Promise.all([fetchStatus(), fetchReportsList()]);
      setStatus(statusRes);
      setReports(Array.isArray(reportsRes) ? reportsRes : []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to contact Deemind service.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus().catch(() => setError('Unable to contact Deemind service.'));
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="flex-1">{error}</p>
          <button className="btn-ghost text-xs" onClick={refreshStatus} disabled={loading}>
            Retry
          </button>
        </div>
      )}
      <div className="grid md:grid-cols-3 gap-4">
        <StatsCard title="Current Task" value={status.current?.label || 'Idle'} subtitle={`${status.queue.length} queued`} accent="amber" />
        <StatsCard title="Reports Generated" value={reports.length} subtitle={loading ? 'Refreshing…' : 'Latest scan'} accent="blue" />
        <StatsCard title="Mapper Status" value="Stable" subtitle="Twig structure normalized" accent="green" />
      </div>
      <StubStatusCard description="Need to preview parser output? Fire up the runtime stub directly from here." />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Live Parser Logs</h2>
          <button className="btn-secondary" onClick={refreshStatus} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <LogViewer />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-2">Recent Reports</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Name</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 10).map((report) => (
                <tr key={report.name} className="border-t border-slate-100">
                  <td className="py-2">{report.name}</td>
                  <td>{typeof report.size === 'number' ? `${(report.size / 1024).toFixed(1)} kB` : '—'}</td>
                  <td>{report.modified ? new Date(report.modified).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {!reports.length && (
                <tr>
                  <td className="py-4 text-center text-slate-500" colSpan={3}>
                    No reports yet. Trigger a build to generate parser artifacts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

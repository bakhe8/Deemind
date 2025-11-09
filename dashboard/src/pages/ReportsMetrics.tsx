import { useEffect, useState } from 'react';
import BaselineBarChart from '../components/charts/BaselineBarChart';
import { fetchBaselineLogs, fetchBaselineMetrics } from '../api/system';
import RuntimeEventFeed from '../components/RuntimeEventFeed';
import RuntimeAnalyticsTable from '../components/RuntimeAnalyticsTable';

export default function ReportsMetrics() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchBaselineMetrics().then((res) => setMetrics(res.metrics)).catch(() => undefined);
    fetchBaselineLogs().then((res) => setLogs(res.logs)).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <RuntimeAnalyticsTable />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">Baseline Metrics</h2>
        <BaselineBarChart data={metrics.slice(-8)} />
      </div>
      <RuntimeEventFeed title="Live Runtime Events" limit={8} />
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

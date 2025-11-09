import { useEffect, useMemo, useState } from 'react';
import StatsCard from '../components/StatsCard';
import { fetchThemes, fetchThemeReports, type ThemeSummary } from '../api/themes';
import StubStatusCard from '../components/StubStatusCard';
import RuntimeEventFeed from '../components/RuntimeEventFeed';
import ScenarioRunsPanel from '../components/ScenarioRunsPanel';
import ScenarioRunnerControls from '../components/ScenarioRunnerControls';
import RuntimeAnalyticsTable from '../components/RuntimeAnalyticsTable';
import { useBuildStream } from '../hooks/useBuildStream';

export default function ValidationQA() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [report, setReport] = useState<any>(null);
  const [scenarioRefreshKey, setScenarioRefreshKey] = useState(0);

  useEffect(() => {
    fetchThemes().then((res) => setThemes(res.themes)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedTheme) return;
    fetchThemeReports(selectedTheme).then(setReport).catch(() => setReport(null));
  }, [selectedTheme]);

  const errors = report?.extended?.errors || [];
  const warnings = report?.extended?.warnings || [];
  const errorBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    errors.forEach((entry: any) => {
      const key = entry?.type || 'unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [errors]);
  const warningBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    warnings.forEach((entry: any) => {
      const key = entry?.type || 'unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [warnings]);
  const { sessions } = useBuildStream();
  const recentBuilds = useMemo(
    () =>
      sessions
        .filter((session) => !selectedTheme || session.theme === selectedTheme)
        .slice(0, 6),
    [sessions, selectedTheme],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm" value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value)}>
          <option value="">Select theme</option>
          {themes.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Auto-fix common issues</button>
      </div>
      <StubStatusCard
        defaultTheme={selectedTheme}
        description="Validation results are easiest to inspect with the mock runtime running."
      />
      <RuntimeAnalyticsTable theme={selectedTheme || undefined} />
      <RuntimeEventFeed theme={selectedTheme || undefined} />
      <ScenarioRunnerControls
        theme={selectedTheme || undefined}
        onQueued={() => setScenarioRefreshKey((key) => key + 1)}
      />
      <ScenarioRunsPanel refreshKey={scenarioRefreshKey} />
      <div className="grid md:grid-cols-3 gap-4">
        <StatsCard title="Errors" value={errors.length} accent="red" />
        <StatsCard title="Warnings" value={warnings.length} accent="amber" />
        <StatsCard title="Whitelisted" value={warnings.filter((w: any) => w.type?.includes('baseline')).length} accent="green" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-rose-600 mb-3">Error Breakdown</h3>
          {!errorBreakdown.length ? (
            <p className="text-xs text-slate-500">No errors detected.</p>
          ) : (
            <ul className="space-y-2">
              {errorBreakdown.slice(0, 6).map(([type, count]) => (
                <li key={`error-break-${type}`}>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{type}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-rose-50 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, (count / (errors.length || 1)) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-amber-600 mb-3">Warning Breakdown</h3>
          {!warningBreakdown.length ? (
            <p className="text-xs text-slate-500">No warnings detected.</p>
          ) : (
            <ul className="space-y-2">
              {warningBreakdown.slice(0, 6).map(([type, count]) => (
                <li key={`warning-break-${type}`}>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{type}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, (count / (warnings.length || 1)) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Recent Build Quality</h3>
        {!recentBuilds.length ? (
          <p className="text-xs text-slate-500">Trigger a build to see correlated validation metrics.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Build</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Errors</th>
                  <th className="py-2 pr-3">Warnings</th>
                  <th className="py-2 pr-3">Finished</th>
                </tr>
              </thead>
              <tbody>
                {recentBuilds.map((build) => (
                  <tr key={build.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      {build.theme} {build.diff ? '(diff)' : ''}
                    </td>
                    <td className="py-2 pr-3 capitalize">{build.status}</td>
                    <td className="py-2 pr-3">
                      {build.metrics ? build.metrics.errors : build.status === 'running' ? '—' : 'n/a'}
                    </td>
                    <td className="py-2 pr-3">
                      {build.metrics ? build.metrics.warnings : build.status === 'running' ? '—' : 'n/a'}
                    </td>
                    <td className="py-2 pr-3">
                      {build.finishedAt ? new Date(build.finishedAt).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-4">Validation Report</h2>
        {errors.length === 0 && warnings.length === 0 && <p className="text-sm text-slate-500">No validator output yet.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-600 mb-2">Errors</h3>
            <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {errors.map((err: any, idx: number) => (
                <li key={`err-${idx}`} className="bg-rose-50 border border-rose-100 rounded-lg p-2">
                  <p className="font-semibold text-rose-700">{err.type}</p>
                  <p className="text-slate-600">{err.file}</p>
                  <p className="text-xs text-slate-500">{err.message}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-600 mb-2">Warnings</h3>
            <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {warnings.map((warn: any, idx: number) => (
                <li key={`warn-${idx}`} className="bg-amber-50 border border-amber-100 rounded-lg p-2">
                  <p className="font-semibold text-amber-700">{warn.type}</p>
                  <p className="text-slate-600">{warn.file}</p>
                  <p className="text-xs text-slate-500">{warn.message}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import StatsCard from '../components/StatsCard';
import DiffViewer from '../components/DiffViewer';
import { fetchThemes, fetchThemeReports, type ThemeSummary } from '../api/themes';
import StubStatusCard from '../components/StubStatusCard';

export default function AdapterBaseline() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [reports, setReports] = useState<any>(null);

  useEffect(() => {
    fetchThemes().then((res) => setThemes(res.themes)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedTheme) return;
    fetchThemeReports(selectedTheme).then(setReports).catch(() => setReports(null));
  }, [selectedTheme]);

  const stats = reports?.baseline?.stats || {};

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
        <span className="text-sm text-slate-500">Baseline completion overview.</span>
      </div>
      <StubStatusCard
        defaultTheme={selectedTheme}
        description="Baseline fills rely on the latest preview build. Spin up the stub to inspect results instantly."
      />
      {reports ? (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <StatsCard title="Baseline" value={reports.baseline?.baselineName || 'n/a'} subtitle={`Commit: ${reports.baseline?.baselineCommit || '—'}`} accent="blue" />
            <StatsCard title="Layouts" value={stats.layouts || 0} subtitle="Copied" accent="green" />
            <StatsCard title="Pages" value={stats.pages || 0} subtitle="Copied" accent="green" />
            <StatsCard title="Components" value={stats.components || 0} subtitle="Copied" accent="green" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <h2 className="text-lg font-semibold">Baseline Diff</h2>
            <DiffViewer content={reports.diff} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Select a theme to inspect adapter output.</p>
      )}
    </div>
  );
}

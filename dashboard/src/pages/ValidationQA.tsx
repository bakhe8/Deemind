import { useEffect, useState } from 'react';
import StatsCard from '../components/StatsCard';
import { fetchThemes, fetchThemeReports, type ThemeSummary } from '../api/themes';
import StubStatusCard from '../components/StubStatusCard';
import RuntimeEventFeed from '../components/RuntimeEventFeed';

export default function ValidationQA() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetchThemes().then((res) => setThemes(res.themes)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedTheme) return;
    fetchThemeReports(selectedTheme).then(setReport).catch(() => setReport(null));
  }, [selectedTheme]);

  const errors = report?.extended?.errors || [];
  const warnings = report?.extended?.warnings || [];

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
      <div className="grid md:grid-cols-3 gap-4">
        <StatsCard title="Errors" value={errors.length} accent="red" />
        <StatsCard title="Warnings" value={warnings.length} accent="amber" />
        <StatsCard title="Whitelisted" value={warnings.filter((w: any) => w.type?.includes('baseline')).length} accent="green" />
      </div>
      <RuntimeEventFeed />
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

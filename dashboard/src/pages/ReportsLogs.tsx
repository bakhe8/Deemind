import { useEffect, useMemo, useState } from 'react';
import LogViewer from '../components/LogViewer';
import { useThemesCatalog } from '../hooks/useThemesCatalog';
import { getExtendedReport } from '../lib/api';
import { digestReport, getRemediationLink, type IssueGroup } from '../lib/reports';

const FILTERS: Array<{ label: string; value: 'all' | 'error' | 'warning' }> = [
  { label: 'All', value: 'all' },
  { label: 'Errors', value: 'error' },
  { label: 'Warnings', value: 'warning' },
];

export default function ReportsAndLogs() {
  const { themes, loading, error, refresh } = useThemesCatalog();
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!themes.length) return;
    if (!selectedTheme) {
      setSelectedTheme(themes[0].name);
    }
  }, [themes, selectedTheme]);

  useEffect(() => {
    if (!selectedTheme) return;
    setReportLoading(true);
    getExtendedReport(selectedTheme)
      .then((payload) => {
        setReport(payload);
        setReportError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Unable to load report';
        setReportError(message);
        setReport(null);
      })
      .finally(() => setReportLoading(false));
  }, [selectedTheme]);

  const digest = useMemo(() => digestReport(report), [report]);
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matchesFilter = (group: IssueGroup) => {
      if (issueFilter !== 'all' && group.level !== issueFilter) return false;
      if (!query) return true;
      return (
        group.label.toLowerCase().includes(query) ||
        group.entries.some(
          (entry) =>
            entry.message.toLowerCase().includes(query) ||
            (entry.page?.toLowerCase().includes(query) ?? false),
        )
      );
    };
    return digest.groups.filter(matchesFilter);
  }, [digest.groups, issueFilter, search]);

  const handleDownload = () => {
    if (!report || !selectedTheme) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedTheme}-report-extended.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = async () => {
    // Provide a quick plain-text summary for bug reports without revealing raw JSON.
    const summary = `${selectedTheme || 'Theme'} — ${digest.totals.errors} errors / ${
      digest.totals.warnings
    } warnings\nTop issues: ${digest.groups
      .slice(0, 3)
      .map((group) => `${group.label} (${group.entries.length})`)
      .join(', ')}`;
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(summary);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Reports Mode</p>
          <h2 className="text-2xl font-semibold text-slate-900">Reports &amp; Logs</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Honest readout of `report-extended.json` paired with the live service log stream. No write operations,
            no hidden commands—just the truth of what the factory produced.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Reload Themes
        </button>
      </header>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Extended Report</p>
                <p className="text-sm text-slate-500">
                  {digest.totals.errors} errors · {digest.totals.warnings} warnings
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  disabled={loading}
                >
                  <option value="" disabled>
                    Select theme
                  </option>
                  {themes.map((theme) => (
                    <option key={theme.name} value={theme.name}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by message or page"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-white disabled:opacity-40"
                  disabled={!report}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-white disabled:opacity-40"
                  disabled={!report}
                >
                  Copy Summary
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((button) => (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => setIssueFilter(button.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    issueFilter === button.value
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {button.label}
                </button>
              ))}
            </div>
            {reportError && <p className="text-sm text-rose-600">{reportError}</p>}
            {reportLoading ? (
              <p className="text-sm text-slate-500">Loading report…</p>
            ) : filteredGroups.length ? (
              <div className="space-y-3 max-h-[26rem] overflow-auto pr-1">
                {filteredGroups.map((group) => (
                  <IssueGroupCard key={group.key} group={group} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No issues match the current filters.</p>
            )}
          </div>
          <details className="rounded-2xl border border-slate-200 bg-white/60 p-4 text-xs text-slate-500">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Raw JSON (debug)
            </summary>
            {report ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950/90 p-4 text-xs text-slate-100">
                {JSON.stringify(report, null, 2)}
              </pre>
            ) : (
              <p className="mt-3">Select a theme to view the full report payload.</p>
            )}
          </details>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-950/95 p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between text-white/70 text-sm">
            <span>Service Log Stream</span>
            <span className="text-xs text-slate-400">SSE /api/log/stream</span>
          </div>
          <LogViewer />
        </div>
      </div>
    </section>
  );
}

function IssueGroupCard({ group }: { group: IssueGroup }) {
  const levelBadge =
    group.level === 'error'
      ? 'bg-rose-500/15 text-rose-100 border border-rose-400/40'
      : 'bg-amber-500/15 text-amber-100 border border-amber-400/40';
  const remediation = getRemediationLink(group.label);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{group.label}</p>
          <p className="text-xs text-slate-500">{group.entries.length} occurrences</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${levelBadge}`}>
          {group.level}
        </span>
      </div>
      {remediation && (
        <a
          href={remediation}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
        >
          Remediation Guide ↗
        </a>
      )}
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {group.entries.slice(0, 4).map((entry) => (
          <li key={entry.id} className="rounded-lg bg-white/70 px-3 py-2 shadow-inner">
            <p className="font-semibold text-slate-900 text-xs uppercase tracking-wide">{entry.code}</p>
            <p className="text-sm">{entry.message}</p>
            {entry.page && <p className="text-xs text-slate-500">Page: {entry.page}</p>}
          </li>
        ))}
        {group.entries.length > 4 && (
          <li className="text-xs text-slate-500">+{group.entries.length - 4} more…</li>
        )}
      </ul>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeRecord } from '../lib/api';
import { getExtendedReport, getStatus, triggerBuild } from '../lib/api';
import { useThemesCatalog } from '../hooks/useThemesCatalog';

type ExtendedReport = {
  errors?: Array<{ code?: string; message?: string; page?: string }>;
  warnings?: Array<{ code?: string; message?: string; page?: string }>;
  [key: string]: unknown;
};

function formatIssue(issue: { code?: string; message?: string; page?: string }) {
  const code = issue.code ? `[${issue.code}]` : '';
  const page = issue.page ? ` • ${issue.page}` : '';
  return `${code} ${issue.message || 'Unknown issue'}${page}`.trim();
}

function ValidationPanel({ theme, report }: { theme: string; report: ExtendedReport | null }) {
  if (!theme) return null;
  const errors = report?.errors ?? [];
  const warnings = report?.warnings ?? [];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Validation</p>
        <h3 className="text-lg font-semibold text-slate-900">
          {theme} — {errors.length} errors · {warnings.length} warnings
        </h3>
        <p className="text-sm text-slate-500">
          Snapshot from <code className="font-mono text-xs text-slate-600">report-extended.json</code>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-rose-600 uppercase mb-2">Errors</p>
          {errors.length === 0 ? (
            <p className="text-sm text-slate-500">No blocking errors reported.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {errors.slice(0, 6).map((issue, idx) => (
                <li key={`${issue.code}-${idx}`} className="rounded-lg bg-rose-50 p-2">
                  {formatIssue(issue)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase mb-2">Warnings</p>
          {warnings.length === 0 ? (
            <p className="text-sm text-slate-500">No warnings reported.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {warnings.slice(0, 6).map((issue, idx) => (
                <li key={`${issue.code}-${idx}`} className="rounded-lg bg-amber-50 p-2">
                  {formatIssue(issue)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeRow({
  record,
  onBuild,
  busy,
  selected,
  onSelect,
}: {
  record: ThemeRecord;
  busy: boolean;
  selected: boolean;
  onBuild: (theme: string) => void;
  onSelect: (theme: string) => void;
}) {
  const manifest = record.manifest;
  return (
    <button
      type="button"
      onClick={() => onSelect(record.name)}
      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition ${
        selected ? 'border-slate-900 bg-slate-900/5 shadow-inner' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{record.name}</p>
          <p className="text-xs text-slate-500">Warnings: {manifest?.warnings ?? 0}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{manifest ? 'Built' : 'New'}</span>
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              manifest ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Updated {manifest?.buildTime ? new Date(manifest.buildTime).toLocaleString() : '—'}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBuild(record.name);
          }}
          className="rounded-full border border-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900 hover:bg-slate-900 hover:text-white"
          disabled={busy}
        >
          {busy ? 'Enqueuing…' : 'Build'}
        </button>
      </div>
    </button>
  );
}

export default function BuildValidation() {
  const { themes, loading, error, refresh } = useThemesCatalog();
  const [status, setStatus] = useState<{ current: any; queue: any[] } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [report, setReport] = useState<ExtendedReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [busyTheme, setBusyTheme] = useState<string | null>(null);

  useEffect(() => {
    if (!themes.length) return;
    if (!selectedTheme) {
      setSelectedTheme(themes[0].name);
    }
  }, [selectedTheme, themes]);

  const loadStatus = useCallback(async () => {
    try {
      const payload = await getStatus();
      setStatus(payload);
      setStatusError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load status';
      setStatusError(message);
    }
  }, []);

  useEffect(() => {
    loadStatus().catch(() => undefined);
    const timer = setInterval(() => loadStatus().catch(() => undefined), 15000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const loadReport = useCallback(
    async (theme: string) => {
      try {
        setLoadingReport(true);
        const payload = await getExtendedReport(theme);
        setReport(payload);
        setReportError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to load report';
        setReportError(message);
        setReport(null);
      } finally {
        setLoadingReport(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedTheme) {
      loadReport(selectedTheme).catch(() => undefined);
    }
  }, [selectedTheme, loadReport]);

  const handleBuild = async (theme: string) => {
    setBusyTheme(theme);
    try {
      await triggerBuild(theme);
      await loadStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyTheme(null);
      refresh();
    }
  };

  const queueItems = useMemo(() => {
    if (!status) return [];
    const items = [];
    if (status.current) items.push({ label: status.current.label || status.current.id, state: 'running' });
    for (const item of status.queue || []) {
      items.push({ label: item.label || item.id, state: 'queued' });
    }
    return items;
  }, [status]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Manufacturing Mode</p>
          <h2 className="text-2xl font-semibold text-slate-900">Build &amp; Validation</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Trigger builds safely via the service runner. Results flow into{' '}
            <code className="font-mono text-xs text-slate-600">/output/&lt;theme&gt;/report-extended.json</code> and are
            rendered here without React mutating files.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            refresh();
            loadStatus().catch(() => undefined);
          }}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Sync Status
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Queue</p>
            {statusError && <p className="text-xs text-rose-600">{statusError}</p>}
            {queueItems.length === 0 ? (
              <p className="text-sm text-slate-500">Factory is idle.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700">
                {queueItems.map((item, idx) => (
                  <li key={`${item.label}-${idx}`} className="flex items-center justify-between">
                    <span>{item.label}</span>
                    <span className="text-xs uppercase text-slate-400">{item.state}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {loading ? (
              <p className="text-sm text-slate-500">Loading themes…</p>
            ) : (
              themes.map((theme) => (
                <ThemeRow
                  key={theme.name}
                  record={theme}
                  busy={busyTheme === theme.name}
                  selected={selectedTheme === theme.name}
                  onBuild={handleBuild}
                  onSelect={setSelectedTheme}
                />
              ))
            )}
          </div>
        </div>
        <div>
          {reportError && <p className="text-sm text-rose-600 mb-2">{reportError}</p>}
          {loadingReport ? (
            <p className="text-sm text-slate-500">Loading validation report…</p>
          ) : (
            <ValidationPanel theme={selectedTheme} report={report} />
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { ThemeSummary, PreviewMatrixEntry, RuntimeStubInfo } from '../api';

type Props = {
  themes: ThemeSummary[];
  stubs: RuntimeStubInfo[];
  title?: string;
  description?: string;
  actionLoading?: boolean;
  loading?: boolean;
  activeTheme?: string;
  previewMap?: Record<string, PreviewMatrixEntry | undefined>;
  previewLoading?: boolean;
  onStart(theme: string): void | Promise<void>;
  onStop(theme: string): void | Promise<void>;
  onRefresh(): void | Promise<void>;
  onSelectTheme?: (theme: string) => void;
  onOpenPreview?: (theme: string) => void;
};

export default function ThemeStubList({
  themes,
  stubs,
  title = 'Preview Controls',
  description = 'Launch or stop runtime stubs per theme.',
  actionLoading = false,
  loading = false,
  activeTheme,
  previewMap,
  previewLoading = false,
  onStart,
  onStop,
  onRefresh,
  onSelectTheme,
  onOpenPreview,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'running' | 'missing'>('all');
  const stubMap = useMemo(() => {
    const map = new Map<string, RuntimeStubInfo>();
    stubs.forEach((stub) => map.set(stub.theme, stub));
    return map;
  }, [stubs]);

  const filteredThemes = useMemo(() => {
    if (filter === 'all') return themes;
    if (filter === 'running') {
      return themes.filter((theme) => Boolean(stubMap.get(theme.name)?.running));
    }
    if (filter === 'missing') {
      return themes.filter((theme) => {
        const entry = previewMap?.[theme.name];
        if (!entry) return true;
        return entry.pages.length === 0 || entry.status === 'missing' || entry.missing;
      });
    }
    return themes;
  }, [filter, previewMap, stubMap, themes]);

  const missingFilterDisabled = !previewMap || Object.keys(previewMap).length === 0;

  useEffect(() => {
    if (missingFilterDisabled && filter === 'missing') {
      setFilter('all');
    }
  }, [missingFilterDisabled, filter]);

  const handleOpen = (theme: string) => {
    if (!onOpenPreview) return;
    onOpenPreview(theme);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <span>Filter:</span>
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-100">
              <button
                className={`px-2 py-0.5 rounded-full ${filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`px-2 py-0.5 rounded-full ${filter === 'running' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                onClick={() => setFilter('running')}
              >
                Running
              </button>
              <button
                className={`px-2 py-0.5 rounded-full ${filter === 'missing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600/70'}`}
                onClick={() => !missingFilterDisabled && setFilter('missing')}
                disabled={missingFilterDisabled}
              >
                Missing
              </button>
            </div>
          </div>
        </div>
        <button className="btn-ghost text-xs" onClick={() => onRefresh()}>
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading stub status…</p>
      ) : filteredThemes.length === 0 ? (
        <p className="text-xs text-slate-500">No themes detected yet.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {previewLoading && (
            <li className="text-[11px] text-slate-400 px-1">Updating snapshot coverage…</li>
          )}
          {filteredThemes.map((theme) => {
            const stub = stubMap.get(theme.name);
            const running = Boolean(stub?.running);
            const previewInfo = previewMap?.[theme.name];
            const snapshotReady = previewInfo && previewInfo.pages.length > 0 && previewInfo.status === 'ready';
            const snapshotLabel = previewInfo
              ? `${previewInfo.pages.length} page${previewInfo.pages.length === 1 ? '' : 's'} · ${previewInfo.status}`
              : 'No snapshots recorded';
            const snapshotClass = snapshotReady
              ? 'text-emerald-600'
              : previewInfo
                ? 'text-amber-600'
                : 'text-slate-400';
            return (
              <li
                key={theme.name}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                  activeTheme === theme.name ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-700 hover:underline"
                    onClick={() => onSelectTheme?.(theme.name)}
                  >
                    {theme.name}
                  </button>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${running ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    />
                    {running
                      ? `Running on :${stub?.port ?? '—'}`
                      : `Idle • ${theme.status === 'built' ? 'Built' : 'Unbuilt'}`}
                  </p>
                  <p className={`text-[11px] ${snapshotClass}`}>
                    Snapshots: {snapshotLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {running ? (
                    <>
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => onStop(theme.name)}
                        disabled={actionLoading}
                      >
                        Stop
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => handleOpen(theme.name)}
                        disabled={!stub?.port}
                      >
                        Open
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-primary text-xs"
                      onClick={() => onStart(theme.name)}
                      disabled={actionLoading}
                    >
                      Start
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

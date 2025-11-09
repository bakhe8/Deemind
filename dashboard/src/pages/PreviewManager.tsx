import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchThemes,
  fetchPreviewMatrix,
  fetchPreviewStatus,
  generatePreviewSnapshots,
  type ThemeSummary,
  type PreviewMatrixEntry,
} from '../api/themes';
import { useMode } from '../context/ModeContext';

type CoverageRow = {
  name: string;
  status: string;
  total: number;
  missing: string[];
  extra: string[];
  timestamp: string | null;
  loading: boolean;
  error: string | null | undefined;
  preview: PreviewMatrixEntry | null | undefined;
};

function statusBadge(status: string) {
  switch (status) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-700';
    case 'missing':
    case 'missing-pages':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function PreviewManager() {
  const { mode } = useMode();
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [compareTheme, setCompareTheme] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [previewMap, setPreviewMap] = useState<Record<string, PreviewMatrixEntry | null>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string | null>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basePreview = selectedTheme ? previewMap[selectedTheme] ?? null : null;
  const comparePreview = compareTheme ? previewMap[compareTheme] ?? null : null;
  const baseLoading = selectedTheme ? Boolean(previewLoading[selectedTheme]) : false;
  const compareLoading = compareTheme ? Boolean(previewLoading[compareTheme]) : false;
  const baseErrorMessage = selectedTheme ? previewErrors[selectedTheme] : null;
  const compareErrorMessage = compareTheme ? previewErrors[compareTheme] : null;

  useEffect(() => {
    fetchThemes()
      .then((res) => setThemes(res.themes || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!themes.length) {
      setSelectedTheme('');
      return;
    }
    setSelectedTheme((prev) => {
      if (prev && themes.some((theme) => theme.name === prev)) {
        return prev;
      }
      return themes[0].name;
    });
  }, [themes]);

  useEffect(() => {
    if (!themes.length) {
      setCompareTheme('');
      return;
    }
    setCompareTheme((prev) => {
      if (prev && prev !== selectedTheme && themes.some((theme) => theme.name === prev)) {
        return prev;
      }
      const fallback = themes.find((theme) => theme.name !== selectedTheme);
      return fallback ? fallback.name : selectedTheme;
    });
  }, [themes, selectedTheme]);

  const refreshPreview = useCallback(async (theme: string) => {
    if (!theme) return null;
    setPreviewLoading((prev) => ({ ...prev, [theme]: true }));
    setPreviewErrors((prev) => ({ ...prev, [theme]: null }));
    try {
      const status = await fetchPreviewStatus(theme);
      setPreviewMap((prev) => ({ ...prev, [theme]: { ...status, theme, missing: false } }));
      return status;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load preview metadata.';
      setPreviewErrors((prev) => ({ ...prev, [theme]: reason }));
      return null;
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [theme]: false }));
    }
  }, []);

  const refreshMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try {
      const res = await fetchPreviewMatrix();
      const nextMap: Record<string, PreviewMatrixEntry | null> = {};
      const nextErrors: Record<string, string | null> = {};
      res.previews.forEach((entry) => {
        nextMap[entry.theme] = entry;
        nextErrors[entry.theme] = entry.missing ? 'Snapshots missing — run a build or seed preview-static.' : null;
      });
      setPreviewMap(nextMap);
      setPreviewErrors(nextErrors);
      setPreviewLoading({});
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load snapshot coverage.';
      setError(reason);
    } finally {
      setMatrixLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!themes.length) {
      setPreviewMap({});
      setPreviewErrors({});
      return;
    }
    refreshMatrix();
  }, [themes, refreshMatrix]);

  useEffect(() => {
    const pages = basePreview?.pages || [];
    if (!pages.length) {
      setSelectedPage('');
      return;
    }
    setSelectedPage((prev) => {
      if (prev && pages.includes(prev)) {
        return prev;
      }
      return pages[0];
    });
  }, [basePreview]);

  const pageList = basePreview?.pages || [];
  const comparePageExists = selectedPage ? Boolean(comparePreview?.pages?.includes(selectedPage)) : false;

  const missingInCompare = useMemo(() => {
    if (!basePreview?.pages || !comparePreview?.pages) return [];
    return basePreview.pages.filter((page) => !comparePreview.pages.includes(page));
  }, [basePreview, comparePreview]);

  const missingInBase = useMemo(() => {
    if (!basePreview?.pages || !comparePreview?.pages) return [];
    return comparePreview.pages.filter((page) => !basePreview.pages.includes(page));
  }, [basePreview, comparePreview]);

  const coverageRows = useMemo<CoverageRow[]>(() => {
    const basePages = new Set(basePreview?.pages || []);
    return themes.map((theme) => {
      const record = previewMap[theme.name];
      const pages = record?.pages || [];
      const missing = basePages.size ? Array.from(basePages).filter((page) => !pages.includes(page)) : [];
      const extra = basePages.size ? pages.filter((page) => !basePages.has(page)) : [];
      const status = record?.status || (record === null ? 'missing' : 'unscanned');
      return {
        name: theme.name,
        status,
        total: pages.length,
        missing,
        extra,
        timestamp: record?.timestamp || null,
        loading: Boolean(previewLoading[theme.name]),
        error: previewErrors[theme.name],
        preview: record,
      };
    });
  }, [themes, previewMap, previewErrors, previewLoading, basePreview]);

  const coverageStats = useMemo(() => {
    if (!coverageRows.length) {
      return { ready: 0, missing: 0, totalPages: 0 };
    }
    let ready = 0;
    let missing = 0;
    let totalPages = 0;
    coverageRows.forEach((row) => {
      if (row.total > 0 && !row.error) {
        ready += 1;
      } else {
        missing += 1;
      }
      totalPages += row.total;
    });
    return { ready, missing, totalPages };
  }, [coverageRows]);

  const readinessPercent = themes.length ? Math.round((coverageStats.ready / themes.length) * 100) : 0;
  const missingRows = useMemo(
    () =>
      coverageRows.filter(
        (row) =>
          row.error ||
          row.total === 0 ||
          row.status !== 'ready' ||
          row.missing.length > 0 ||
          row.extra.length > 0,
      ),
    [coverageRows],
  );
  const missingPreviewList = missingRows.slice(0, 5);

  const handleGenerate = async (theme: string) => {
    if (!theme) return;
    setGeneratingTheme(theme);
    setMessage(null);
    setError(null);
    try {
      await generatePreviewSnapshots(theme);
      await refreshPreview(theme);
      setMessage(`Preview snapshots generated for ${theme}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to generate preview snapshots.';
      setError(reason);
    } finally {
      setGeneratingTheme(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleGenerateAll = async () => {
    if (!themes.length) return;
    setBulkGenerating(true);
    setBulkStatus('');
    setError(null);
    const failures: string[] = [];
    for (const theme of themes) {
      try {
        setBulkStatus(theme.name);
        await generatePreviewSnapshots(theme.name);
        await refreshPreview(theme.name);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Failed to generate preview snapshots.';
        failures.push(`${theme.name}: ${reason}`);
      }
    }
    if (failures.length) {
      setError(failures.join(' | '));
    } else {
      setMessage(`Snapshots refreshed for ${themes.length} theme${themes.length === 1 ? '' : 's'}.`);
    }
    setBulkStatus('');
    setBulkGenerating(false);
    setTimeout(() => setMessage(null), 4000);
  };

  const baseSnapshotUrl = selectedTheme && selectedPage ? `/preview-static/${selectedTheme}/${selectedPage}.html` : null;
  const compareSnapshotUrl =
    compareTheme && selectedPage && comparePageExists ? `/preview-static/${compareTheme}/${selectedPage}.html` : null;

  const handleSelectBase = (themeName: string) => {
    if (!themeName || themeName === selectedTheme) return;
    setSelectedTheme(themeName);
    setSelectedPage('');
  };

  const handleSelectCompare = (themeName: string) => {
    if (!themeName || themeName === compareTheme || themeName === selectedTheme) return;
    setCompareTheme(themeName);
  };

  const headerDescription =
    mode === 'friendly'
      ? 'Choose a base theme, then flip into Friendly Mode for cards and summaries or Developer Mode for raw logs and diffs.'
      : 'Regenerate static snapshots, inspect per-theme coverage, and diff any two previews side-by-side.';

  return (
    <>
      {message && (
        <div className="fixed top-4 right-4 z-30 rounded-xl border border-emerald-200 bg-white shadow-xl shadow-emerald-200/40 px-4 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}
      <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold">Preview Manager</h1>
            <p className="text-xs text-slate-500">{headerDescription}</p>
          </div>
          <div className="flex-1" />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedTheme}
            onChange={(e) => handleSelectBase(e.target.value)}
          >
            <option value="">Select base theme…</option>
            {themes.map((theme) => (
              <option key={theme.name} value={theme.name}>
                {theme.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary text-sm"
            onClick={() => handleGenerate(selectedTheme)}
            disabled={!selectedTheme || Boolean(generatingTheme) || bulkGenerating}
          >
            {generatingTheme === selectedTheme ? 'Working…' : 'Generate Base Snapshots'}
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Theme Snapshot Coverage</p>
            <p className="text-xs text-slate-500">Track every theme’s preview status and trigger bulk refreshes.</p>
          </div>
          <div className="flex-1" />
          <button
            className="btn-ghost text-xs"
            onClick={refreshMatrix}
            disabled={matrixLoading || bulkGenerating}
          >
            {matrixLoading ? 'Refreshing…' : 'Refresh Matrix'}
          </button>
          <button className="btn-secondary text-xs" onClick={handleGenerateAll} disabled={bulkGenerating || !themes.length}>
            {bulkGenerating ? `Generating ${bulkStatus || '…'}` : 'Generate All Snapshots'}
          </button>
        </div>
        {mode === 'friendly' && (
          <div className="rounded-xl bg-slate-50 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Ready Themes</span>
              <span className="font-semibold text-slate-700">
                {coverageStats.ready}/{themes.length || 0}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${readinessPercent}%` }} />
            </div>
            <p className="text-[11px] text-slate-500">
              {readinessPercent}% of themes have active snapshots ({coverageStats.totalPages} pages indexed).
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Theme</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Pages</th>
                <th className="py-2 pr-3">Coverage vs {selectedTheme || 'base'}</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coverageRows.map((row) => {
                const activeBase = row.name === selectedTheme;
                const activeCompare = row.name === compareTheme;
                const missingCount = row.missing.length;
                const extraCount = row.extra.length;
                const generating = generatingTheme === row.name;
                const disableActions = bulkGenerating || generating;
                return (
                  <tr key={row.name} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-700">{row.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {activeBase ? 'Base' : activeCompare ? 'Compare' : row.preview?.missing ? 'Needs build' : 'Idle'}
                        </span>
                      </div>
                      {row.error && <p className="text-[11px] text-rose-600">{row.error}</p>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{row.loading ? '…' : row.total}</td>
                    <td className="py-2 pr-3">
                      {selectedTheme && !activeBase ? (
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className={missingCount ? 'text-rose-600' : 'text-emerald-600'}>
                            {missingCount ? `${missingCount} missing` : 'All pages present'}
                          </span>
                          {!!extraCount && <span className="text-amber-600">{extraCount} extra</span>}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[11px] text-slate-500">{formatTimestamp(row.timestamp)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => handleSelectBase(row.name)}
                          disabled={activeBase || disableActions}
                        >
                          Base
                        </button>
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => handleSelectCompare(row.name)}
                          disabled={activeBase || activeCompare || disableActions}
                        >
                          Compare
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => handleGenerate(row.name)}
                          disabled={disableActions}
                        >
                          {generating ? 'Working…' : 'Generate'}
                        </button>
                        <a
                          className="btn-ghost text-xs"
                          href={row.total ? `/preview-static/${row.name}/${row.preview?.pages?.[0] || 'index'}.html` : '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!row.total) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Open
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          {missingRows.length ? (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-rose-700">
                <span>Missing Coverage</span>
                <span className="text-xs text-rose-500">{missingRows.length} theme{missingRows.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="space-y-2">
                {missingPreviewList.map((row) => {
                  const reason = row.error
                    ? row.error
                    : row.total === 0
                      ? 'No snapshots generated'
                      : row.missing.length
                        ? `${row.missing.length} missing page${row.missing.length === 1 ? '' : 's'}`
                        : row.status !== 'ready'
                          ? `Status: ${row.status}`
                          : row.extra.length
                            ? `${row.extra.length} extra page${row.extra.length === 1 ? '' : 's'}`
                            : 'Needs attention';
                  return (
                    <li key={`missing-${row.name}`} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{row.name}</p>
                        <p className="text-xs text-rose-600">{reason}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-ghost text-xs" onClick={() => handleSelectBase(row.name)}>
                          Set as base
                        </button>
                        <button className="btn-ghost text-xs" onClick={() => handleSelectCompare(row.name)}>
                          Compare
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {missingRows.length > missingPreviewList.length && (
                <p className="text-[11px] text-rose-600">
                  +{missingRows.length - missingPreviewList.length} more theme{missingRows.length - missingPreviewList.length === 1 ? '' : 's'} need snapshots.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-600">
              All tracked themes have snapshot coverage.
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">Base Preview Status</p>
          {baseLoading ? (
            <p className="text-sm text-slate-500">Loading preview metadata…</p>
          ) : basePreview ? (
            <ul className="text-sm text-slate-600 space-y-1">
              <li>
                <strong>Status:</strong> {basePreview.status}
              </li>
              <li>
                <strong>Port:</strong> {basePreview.port ?? '—'}
              </li>
              <li>
                <strong>Timestamp:</strong> {basePreview.timestamp ? new Date(basePreview.timestamp).toLocaleString() : '—'}
              </li>
              <li>
                <strong>Preview URL:</strong>{' '}
                {basePreview.url ? (
                  <a className="text-blue-600 hover:underline" href={basePreview.url} target="_blank" rel="noreferrer">
                    Open preview
                  </a>
                ) : basePreview.port ? (
                  <a
                    className="text-blue-600 hover:underline"
                    href={`http://localhost:${basePreview.port}/page/${selectedPage || 'index'}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    http://localhost:{basePreview.port}
                  </a>
                ) : (
                  '—'
                )}
              </li>
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {selectedTheme ? 'No preview metadata yet.' : 'Select a theme to inspect its preview.'}
            </p>
          )}
          {baseErrorMessage && <p className="text-xs text-rose-600">{baseErrorMessage}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">Snapshot Pages</p>
          {pageList.length ? (
            <ul className="text-xs text-slate-600 grid sm:grid-cols-2 gap-1 max-h-60 overflow-y-auto">
              {pageList.map((page) => (
                <li
                  key={page}
                  className={`px-3 py-2 rounded-lg flex items-center justify-between ${selectedPage === page ? 'bg-slate-100' : 'bg-slate-50'}`}
                >
                  <button className="font-mono text-[11px] truncate text-left" onClick={() => setSelectedPage(page)}>
                    {page}
                  </button>
                  <a
                    className="text-xs text-blue-600 hover:underline"
                    href={`/preview-static/${selectedTheme}/${page}.html`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No snapshot pages detected.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-700">Compare Theme</p>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={compareTheme}
            onChange={(e) => setCompareTheme(e.target.value)}
          >
            <option value="">Select compare theme…</option>
            {themes
              .filter((theme) => theme.name !== selectedTheme)
              .map((theme) => (
                <option key={theme.name} value={theme.name}>
                  {theme.name}
                </option>
              ))}
          </select>
          <button
            className="btn-secondary text-sm"
            onClick={() => handleGenerate(compareTheme)}
            disabled={!compareTheme || Boolean(generatingTheme) || bulkGenerating}
          >
            {generatingTheme === compareTheme ? 'Working…' : 'Generate Compare Snapshots'}
          </button>
        </div>
        {compareErrorMessage && <p className="text-xs text-rose-600">{compareErrorMessage}</p>}
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{selectedTheme || 'Base'} Snapshot</p>
            {baseSnapshotUrl ? (
              <iframe title="base-preview" src={baseSnapshotUrl} className="w-full h-96 border border-slate-200 rounded-xl" />
            ) : (
              <p className="text-sm text-slate-500">Choose a theme and page to preview.</p>
            )}
            {!!missingInCompare.length && (
              <p className="text-xs text-rose-600 mt-2">Missing from compare: {missingInCompare.join(', ')}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{compareTheme || 'Compare'} Snapshot</p>
            {compareSnapshotUrl ? (
              <iframe title="compare-preview" src={compareSnapshotUrl} className="w-full h-96 border border-slate-200 rounded-xl" />
            ) : (
              <p className="text-sm text-slate-500">
                {compareTheme
                  ? comparePreview?.pages?.length
                    ? comparePageExists
                      ? 'Loading preview…'
                      : 'Page missing from compare theme.'
                    : 'No snapshots available for compare theme.'
                  : 'Select a theme to compare.'}
              </p>
            )}
            {!!missingInBase.length && (
              <p className="text-xs text-amber-600 mt-2">Not in base: {missingInBase.join(', ')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

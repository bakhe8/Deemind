import { useCallback, useEffect, useMemo, useState } from 'react';
import FileDropZone from '../components/FileDropZone';
import ThemeInfoForm from '../components/ThemeInfoForm';
import StatsCard from '../components/StatsCard';
import ThemeStubList from '../components/ThemeStubList';
import {
  fetchThemes,
  fetchThemeStructure,
  fetchThemeMetadata,
  saveThemeMetadata,
  fetchThemePreset,
  saveThemePreset,
  generateThemeDefaults,
  runThemeBuild,
  fetchThemeReports,
  fetchPreviewStatus,
  uploadThemeBundle,
  type ThemeSummary,
  type ThemeStructure,
  type ThemeReports,
  type PreviewStatus,
} from '../api/themes';
import PipelineProgress from '../components/PipelineProgress';
import { useRuntimeStub } from '../hooks/useRuntimeStub';
import { usePreviewMatrix } from '../hooks/usePreviewMatrix';

type DiffGroupProps = {
  title: string;
  accent: 'emerald' | 'rose' | 'amber';
  files: string[];
};

function DiffGroup({ title, accent, files }: DiffGroupProps) {
  const colorClass =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'rose'
        ? 'text-rose-600'
        : 'text-amber-600';
  return (
    <div>
      <div className={`font-semibold ${colorClass}`}>
        {title} ({files.length})
      </div>
      {files.length ? (
        <details className="mt-1 group">
          <summary className="cursor-pointer text-slate-500 group-open:text-slate-700">
            {files.slice(0, 3).map((file, idx) => (
              <span key={`${title}-${file}`} className="block">
                {file}
                {idx === 2 && files.length > 3 ? '…' : ''}
              </span>
            ))}
            {files.length > 3 ? <span className="block">Show all ({files.length})</span> : null}
          </summary>
          {files.length > 3 && (
            <ul className="mt-2 list-disc list-inside text-slate-600">
              {files.map((file) => (
                <li key={`${title}-expanded-${file}`}>{file}</li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <p className="text-slate-400 text-xs">None</p>
      )}
    </div>
  );
}

const baselineOptions = ['theme-raed', 'custom-raed', 'none'];

export default function UploadTheme() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [structure, setStructure] = useState<ThemeStructure | null>(null);
  const [metadata, setMetadata] = useState<any>({ name: '' });
  const [reports, setReports] = useState<ThemeReports | null>(null);
  const [preview, setPreview] = useState<PreviewStatus | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [baseline, setBaseline] = useState('theme-raed');
  const [baselineToggles, setBaselineToggles] = useState({ layouts: true, pages: true, components: true, assets: true });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadDiff, setUploadDiff] = useState<{ added: string[]; removed: string[]; changed: string[] } | null>(null);
  const [lastUploadedTheme, setLastUploadedTheme] = useState<string | null>(null);
  const [presetRaw, setPresetRaw] = useState('{}');
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetSaving, setPresetSaving] = useState(false);
  const [defaultsApplied, setDefaultsApplied] = useState<string[]>([]);
  const [defaultsMessage, setDefaultsMessage] = useState<string | null>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(false);
  const checklist = useMemo(() => {
    if (!structure) return [];
    return [
      {
        id: 'layouts',
        label: 'Layouts',
        ok: structure.layouts.length > 0,
        count: structure.layouts.length,
        tip: 'Add layout/*.twig files.',
      },
      {
        id: 'pages',
        label: 'Pages',
        ok: structure.pages.length > 0,
        count: structure.pages.length,
        tip: 'Add pages/*.twig entries.',
      },
      {
        id: 'components',
        label: 'Partials',
        ok: structure.components.length > 0,
        count: structure.components.length,
        tip: 'Add partials/*.twig snippets.',
      },
      {
        id: 'locales',
        label: 'Locales',
        ok: structure.locales.length > 0,
        count: structure.locales.length,
        tip: 'Add locales/*.json translations.',
      },
    ];
  }, [structure]);
  const {
    status: stubStatus,
    stubs: stubList,
    loading: stubStatusLoading,
    actionLoading: stubActionLoading,
    startStub: launchStub,
    stopStub: haltStub,
    refresh: refreshStubStatus,
  } = useRuntimeStub({ pollMs: 6000, theme: selectedTheme || undefined });
  const {
    map: previewMap,
    loading: previewMatrixLoading,
    refresh: refreshPreviewMatrix,
  } = usePreviewMatrix({ pollMs: 25000 });

  useEffect(() => {
    fetchThemes().then((res) => setThemes(res.themes || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedTheme) return;
    fetchThemeStructure(selectedTheme).then(setStructure).catch(() => setStructure(null));
    fetchThemeMetadata(selectedTheme).then((data) => setMetadata({ name: selectedTheme, ...data })).catch(() => setMetadata({ name: selectedTheme }));
    fetchThemeReports(selectedTheme).then(setReports).catch(() => setReports(null));
    setPreview(null);
    setPreviewLoading(true);
    fetchPreviewStatus(selectedTheme)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [selectedTheme]);

  useEffect(() => {
    if (!selectedTheme) {
      setUploadDiff(null);
      return;
    }
    if (lastUploadedTheme && selectedTheme === lastUploadedTheme) return;
    setUploadDiff(null);
  }, [selectedTheme, lastUploadedTheme]);

  useEffect(() => {
    if (!selectedTheme) {
      setPresetRaw('{}');
      setPresetError(null);
      return;
    }
    setPresetMessage(null);
    fetchThemePreset(selectedTheme)
      .then((data) => {
        const raw = JSON.stringify(data || {}, null, 2);
        setPresetRaw(raw);
        setPresetError(null);
      })
      .catch(() => {
        setPresetRaw('{}');
        setPresetError('Failed to load preset metadata.');
      });
  }, [selectedTheme]);

  const stubMap = useMemo(() => {
    const map = new Map<string, (typeof stubList)[number]>();
    stubList.forEach((stub) => map.set(stub.theme, stub));
    return map;
  }, [stubList]);

  const selectedStub = selectedTheme ? stubMap.get(selectedTheme) : null;

  const readinessText = useMemo(() => {
    if (!structure) return 'Select a theme to inspect its completeness.';
    return structure.completeness >= 90 ? 'Ready for parser' : 'Needs more layouts/pages/locales';
  }, [structure]);

  const stubMatchesSelection = Boolean(selectedStub?.running);
  const canOpenPreview = Boolean(selectedStub?.port || (preview && (preview.url || preview.port)));

  const handleSave = async () => {
    if (!selectedTheme) return;
    await saveThemeMetadata(selectedTheme, metadata);
    setMessage('Metadata saved.');
    setTimeout(() => setMessage(null), 2000);
  };

  const handleSavePreset = async () => {
    if (!selectedTheme) return;
    let parsed: Record<string, any>;
    try {
      parsed = presetRaw.trim() ? JSON.parse(presetRaw) : {};
    } catch (err) {
      setPresetError('Preset JSON is invalid.');
      return;
    }
    setPresetSaving(true);
    setPresetError(null);
    try {
      await saveThemePreset(selectedTheme, parsed);
      setPresetMessage('Preset saved.');
      setTimeout(() => setPresetMessage(null), 3000);
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : 'Failed to save preset.');
    } finally {
      setPresetSaving(false);
    }
  };

  const handleRun = async (withDiff = false) => {
    if (!selectedTheme) return;
    setLoading(true);
    try {
      await runThemeBuild(selectedTheme, { diff: withDiff });
      setMessage('Build queued. Check Parser tab for progress.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setUploading(true);
    setMessage(`Uploading ${file.name}…`);
    try {
      const response = await uploadThemeBundle(file, selectedTheme || undefined);
      const refreshed = await fetchThemes();
      setThemes(refreshed.themes || []);
      setSelectedTheme(response.theme);
      setLastUploadedTheme(response.theme);
      setUploadDiff(response.diff || null);
      if (response.preset) {
        setMetadata((prev: any) => ({ ...prev, ...response.preset }));
        setPresetRaw(JSON.stringify(response.preset, null, 2));
      }
      setDefaultsApplied(response.defaultsApplied || []);
      setMessage(`Uploaded ${file.name} → ${response.theme}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Upload failed';
      setMessage(reason);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = () => {
    if (selectedStub?.port) {
      window.open(`http://localhost:${selectedStub.port}/page/index`, '_blank', 'noopener,noreferrer');
      return;
    }
    const url = preview?.url || (preview?.port ? `http://localhost:${preview.port}/` : null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleStub = async () => {
    if (!selectedTheme) return;
    if (selectedStub?.running) {
      await haltStub(selectedTheme);
      setMessage(`Stopped stub for ${selectedTheme}.`);
    } else {
      await launchStub(selectedTheme);
      setMessage(`Started stub for ${selectedTheme}.`);
    }
    setTimeout(() => setMessage(null), 2000);
  };

  const handleOpenStubPreview = (themeName: string) => {
    const stub = stubMap.get(themeName);
    if (!stub?.port) return;
    window.open(`http://localhost:${stub.port}/page/index`, '_blank', 'noopener,noreferrer');
  };

  const refreshStubsAndPreviews = useCallback(async () => {
    await Promise.all([refreshStubStatus(), refreshPreviewMatrix()]);
  }, [refreshPreviewMatrix, refreshStubStatus]);

  const handleManualRefresh = async () => {
    await refreshStubsAndPreviews();
  };

  const selectedSnapshot = selectedTheme ? previewMap[selectedTheme] : undefined;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <FileDropZone onPick={handleUpload} busy={uploading} />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-slate-500">Available Themes</p>
          <select
            className="mt-2 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedTheme}
            onChange={(e) => {
              setLastUploadedTheme(null);
              setSelectedTheme(e.target.value);
            }}
          >
                  <option value="">Select theme</option>
                  {themes.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} — {t.status}
                    </option>
                  ))}
                </select>
                {selectedTheme ? (
                  <p className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        stubMatchesSelection ? 'bg-emerald-500' : stubList.length ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                    />
                    {stubStatusLoading
                      ? 'Checking runtime stub…'
                      : stubMatchesSelection
                        ? `Stub running locally on :${selectedStub?.port || '—'}`
                        : stubList.length
                          ? `Other stubs active: ${stubList.map((s) => s.theme).join(', ')}`
                          : 'Stub idle.'}
                  </p>
                ) : null}
              </div>
              <button className="btn-secondary" onClick={() => fetchThemes().then((res) => setThemes(res.themes))}>
                Refresh
              </button>
            </div>
            <ThemeInfoForm value={metadata} onChange={setMetadata} />
            <div className="flex gap-3 mt-4">
              <button className="btn-primary" onClick={handleSave} disabled={!selectedTheme || uploading}>
                Save Metadata
              </button>
              <button className="btn-secondary" onClick={() => handleRun(false)} disabled={!selectedTheme || loading || uploading}>
                Run Parser
              </button>
              <button className="btn-ghost" onClick={() => handleRun(true)} disabled={!selectedTheme || loading || uploading}>
                Run With Diff
              </button>
            </div>
            {message && <p className="text-xs text-emerald-600 mt-2">{message}</p>}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-600">Preset Metadata (.deemind.json)</p>
                {presetMessage && <span className="text-xs text-emerald-600">{presetMessage}</span>}
              </div>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs"
                rows={6}
                value={presetRaw}
                onChange={(e) => setPresetRaw(e.target.value)}
                spellCheck={false}
              />
              {presetError && <p className="text-xs text-rose-600">{presetError}</p>}
              <button className="btn-secondary text-xs" onClick={handleSavePreset} disabled={!selectedTheme || presetSaving}>
                {presetSaving ? 'Saving…' : 'Save Preset'}
              </button>
              <p className="text-[11px] text-slate-500">Values saved here prefill metadata automatically on future uploads.</p>
            </div>
            <ThemeStubList
              themes={themes}
              stubs={stubList}
              actionLoading={stubActionLoading}
              loading={stubStatusLoading}
              activeTheme={selectedTheme}
              previewMap={previewMap}
              previewLoading={previewMatrixLoading}
              onStart={(themeName) => launchStub(themeName)}
              onStop={(themeName) => haltStub(themeName)}
              onRefresh={handleManualRefresh}
              onSelectTheme={setSelectedTheme}
              onOpenPreview={handleOpenStubPreview}
            />
          </div>
        </div>
        <div className="space-y-4">
          <StatsCard title="Input Completeness" value={`${structure?.completeness ?? 0}%`} subtitle={readinessText} accent="green" />
          {structure ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-600">Theme Checklist</p>
              <ul className="space-y-2 text-sm">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full ${
                          item.ok ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span>{item.label}</span>
                      <span className="text-xs text-slate-500">({item.count})</span>
                    </div>
                    {!item.ok && <span className="text-xs text-amber-600">{item.tip}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Upload a theme to see the checklist.</p>
            </div>
          )}
          {uploadDiff ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm font-semibold text-slate-600">Latest Upload Diff</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-600">Added</span>
                  <span className="text-amber-600">Changed</span>
                  <span className="text-rose-600">Removed</span>
                </div>
              </div>
              {uploadDiff.added.length + uploadDiff.removed.length + uploadDiff.changed.length === 0 ? (
                <p className="text-xs text-slate-500">No file changes detected compared to the last upload.</p>
              ) : (
                <div className="space-y-3 text-xs text-slate-600">
                  <DiffGroup title="Added" accent="emerald" files={uploadDiff.added} />
                  <DiffGroup title="Changed" accent="amber" files={uploadDiff.changed} />
                  <DiffGroup title="Removed" accent="rose" files={uploadDiff.removed} />
                </div>
              )}
            </div>
          ) : null}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Baseline Merge Settings</p>
            <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full" value={baseline} onChange={(e) => setBaseline(e.target.value)}>
              {baselineOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(baselineToggles).map(([key, val]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setBaselineToggles((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {key}
                </label>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold text-slate-600">Live Preview</p>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary text-xs px-3 py-1"
                  onClick={() => selectedTheme && handleOpenPreview()}
                  disabled={!canOpenPreview}
                >
                  Open
                </button>
                <button
                  className={`${stubMatchesSelection ? 'btn-ghost text-rose-600' : 'btn-primary'} text-xs px-3 py-1`}
                  onClick={handleToggleStub}
                  disabled={!selectedTheme || stubActionLoading}
                >
                  {stubMatchesSelection ? 'Stop stub' : 'Launch stub'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {previewLoading
                ? 'Detecting preview...'
                : preview
                  ? `Status: ${preview.status}${preview.port ? ` • Port ${preview.port}` : ''}`
                  : 'No preview metadata yet.'}
            </p>
            {preview?.pages?.length ? (
              <p className="text-xs text-slate-500">Pages: {preview.pages.slice(0, 4).join(', ')}{preview.pages.length > 4 ? '…' : ''}</p>
            ) : null}
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  stubMatchesSelection ? 'bg-emerald-500' : stubStatus?.running ? 'bg-amber-400' : 'bg-slate-300'
                }`}
              />
              {stubStatusLoading
                ? 'Checking runtime stub…'
                : stubMatchesSelection
                  ? `Stub live on :${stubStatus?.port || '—'}`
                  : stubStatus?.running
                    ? `Stub running for ${stubStatus.theme || 'unknown'} on :${stubStatus.port}`
                    : 'Stub idle. Launch to preview with mock APIs.'}
            </p>
            <p className="text-xs text-slate-500">
              {previewMatrixLoading
                ? 'Syncing snapshot coverage…'
                : selectedSnapshot
                  ? `Snapshot coverage: ${selectedSnapshot.pages.length} page${selectedSnapshot.pages.length === 1 ? '' : 's'} • ${selectedSnapshot.status}`
                  : 'Snapshot coverage: no snapshots detected across preview matrix.'}
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <h2 className="text-lg font-semibold mb-3">Structure Preview</h2>
        {structure ? (
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-semibold text-slate-600">Layouts</p>
              <ul className="text-slate-500 list-disc list-inside">
                {structure.layouts.slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-600">Pages</p>
              <ul className="text-slate-500 list-disc list-inside">
                {structure.pages.slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-600">Components</p>
              <ul className="text-slate-500 list-disc list-inside">
                {structure.components.slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-600">Locales</p>
              <ul className="text-slate-500 list-disc list-inside">
                {structure.locales.slice(0, 5).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select a theme to inspect its structure.</p>
        )}
        <PipelineProgress
          structure={structure}
          reports={reports}
          previewReady={preview?.status === 'ready'}
          previewStatus={preview?.status || null}
        />
      </div>
    </div>
  );
}


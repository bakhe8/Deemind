import { useEffect, useMemo, useState } from 'react';
import FileDropZone from '../components/FileDropZone';
import ThemeInfoForm from '../components/ThemeInfoForm';
import StatsCard from '../components/StatsCard';
import {
  fetchThemes,
  fetchThemeStructure,
  fetchThemeMetadata,
  saveThemeMetadata,
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
  const {
    status: stubStatus,
    loading: stubStatusLoading,
    actionLoading: stubActionLoading,
    startStub: launchStub,
    stopStub: haltStub,
  } = useRuntimeStub({ pollMs: 6000 });

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

  const readinessText = useMemo(() => {
    if (!structure) return 'Select a theme to inspect its completeness.';
    return structure.completeness >= 90 ? 'Ready for parser' : 'Needs more layouts/pages/locales';
  }, [structure]);

  const stubMatchesSelection = Boolean(selectedTheme && stubStatus?.running && stubStatus.theme === selectedTheme);
  const canOpenPreview = Boolean(
    (preview && (preview.url || preview.port)) || (stubMatchesSelection && stubStatus?.port),
  );

  const handleSave = async () => {
    if (!selectedTheme) return;
    await saveThemeMetadata(selectedTheme, metadata);
    setMessage('Metadata saved.');
    setTimeout(() => setMessage(null), 2000);
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
      setMessage(`Uploaded ${file.name} → ${response.theme}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Upload failed';
      setMessage(reason);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenPreview = () => {
    if (stubMatchesSelection && stubStatus?.port) {
      window.open(`http://localhost:${stubStatus.port}/page/index`, '_blank', 'noopener,noreferrer');
      return;
    }
    const url = preview?.url || (preview?.port ? `http://localhost:${preview.port}/` : null);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleStub = async () => {
    if (!selectedTheme) return;
    if (stubMatchesSelection) {
      await haltStub();
      setMessage(`Stopped stub for ${selectedTheme}.`);
    } else {
      await launchStub(selectedTheme);
      setMessage(`Started stub for ${selectedTheme}.`);
    }
    setTimeout(() => setMessage(null), 2000);
  };

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
                  onChange={(e) => setSelectedTheme(e.target.value)}
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
                        stubMatchesSelection ? 'bg-emerald-500' : stubStatus?.running ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                    />
                    {stubStatusLoading
                      ? 'Checking runtime stub…'
                      : stubMatchesSelection
                        ? `Stub running locally on :${stubStatus?.port || '—'}`
                        : stubStatus?.running
                          ? `Stub currently attached to ${stubStatus.theme || 'unknown'}`
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
          </div>
        </div>
        <div className="space-y-4">
          <StatsCard title="Input Completeness" value={`${structure?.completeness ?? 0}%`} subtitle={readinessText} accent="green" />
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchSettings,
  updateBaselineList,
  fetchStubLogs,
  fetchStoreDemos,
  fetchStorePartials,
  applyStorePreset,
  type StoreDemo,
  type StorePartial,
  fetchStoreDiff,
  fetchTwilightStatus,
  updateTwilightStatus,
} from '../api/system';
import { fetchThemes, fetchThemePreset, type ThemeSummary } from '../api/themes';
import { startBuild } from '../api/build';
import ThemeStubList from '../components/ThemeStubList';
import { useRuntimeStub } from '../hooks/useRuntimeStub';
import { fetchBrands, applyBrand, type BrandPreset } from '../api/brands';
import { useBrandWatcher } from '../hooks/useBrandWatcher';
import { usePreviewMatrix } from '../hooks/usePreviewMatrix';

type SettingsPayload = {
  inputDir: string;
  outputDir: string;
  reportsDir: string;
  logsDir: string;
  baselines: string[];
  tokenSet: boolean;
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [baselines, setBaselines] = useState('');
  const [saving, setSaving] = useState(false);
  const [newStubTheme, setNewStubTheme] = useState('demo');
  const [activeStubTheme, setActiveStubTheme] = useState('');
  const [stubLogs, setStubLogs] = useState<string[]>([]);
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [storeDemos, setStoreDemos] = useState<StoreDemo[]>([]);
  const [storePartials, setStorePartials] = useState<StorePartial[]>([]);
  const [selectedStoreDemo, setSelectedStoreDemo] = useState('electronics');
  const [selectedPartials, setSelectedPartials] = useState<string[]>([]);
  const [partialFilter, setPartialFilter] = useState('');
  const [storeOverrides, setStoreOverrides] = useState('');
  const [storePresetMessage, setStorePresetMessage] = useState('');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [storePresetLoading, setStorePresetLoading] = useState(false);
  const [twilightEnabled, setTwilightEnabled] = useState(true);
  const [twilightStatusLoading, setTwilightStatusLoading] = useState(true);
  const [twilightSaving, setTwilightSaving] = useState(false);
  const [storeDiff, setStoreDiff] = useState<any | null>(null);
  const [storeDiffLoading, setStoreDiffLoading] = useState(false);
  const [storeDiffError, setStoreDiffError] = useState('');
  const [brands, setBrands] = useState<BrandPreset[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState('');
  const [brandAction, setBrandAction] = useState<{ slug: string; status: 'pending' | 'success' | 'error'; message?: string } | null>(null);
  const [activeThemePreset, setActiveThemePreset] = useState<Record<string, any> | null>(null);
  const [activePresetLoading, setActivePresetLoading] = useState(false);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const partialDemoRef = useRef<string | null>(null);
  const {
    status: stubStatus,
    stubs: stubList,
    loading: stubStatusLoading,
    actionLoading: stubActionLoading,
    startStub: launchStub,
    stopStub: haltStub,
    refresh: refreshStubStatus,
  } = useRuntimeStub({ pollMs: 8000, theme: activeStubTheme || undefined });
  const {
    map: previewMap,
    loading: previewMatrixLoading,
    refresh: refreshPreviewMatrix,
  } = usePreviewMatrix({ pollMs: 25000 });

  const refreshStubsAndCoverage = useCallback(async () => {
    await Promise.all([refreshStubStatus(), refreshPreviewMatrix()]);
  }, [refreshPreviewMatrix, refreshStubStatus]);

  useEffect(() => {
    fetchSettings().then((data) => {
      const typed = data as SettingsPayload;
      setSettings(typed);
      setBaselines((typed.baselines || []).join(', '));
    });
    fetchStoreDemos()
      .then((res) => {
        setStoreDemos(res.demos || []);
        if ((res.demos || []).length) {
          setSelectedStoreDemo(res.demos[0].id);
        }
      })
      .catch(() => undefined);
    fetchStorePartials()
      .then((res) => setStorePartials(res.partials || []))
      .catch(() => undefined);
    fetchTwilightStatus()
      .then((data) => setTwilightEnabled(Boolean(data.enabled)))
      .catch(() => undefined)
      .finally(() => setTwilightStatusLoading(false));
    fetchThemes()
      .then((res) => setThemes(res.themes || []))
      .catch(() => undefined);
  }, []);

  const refreshBrands = useCallback(async () => {
    setBrandLoading(true);
    setBrandError('');
    try {
      const data = await fetchBrands();
      setBrands(data.brands || []);
    } catch (error) {
      setBrandError(error instanceof Error ? error.message : 'Failed to load brand presets.');
    } finally {
      setBrandLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBrands();
  }, [refreshBrands]);

  useBrandWatcher(refreshBrands, setSseStatus);

  useEffect(() => {
    if (!activeStubTheme) {
      setActiveThemePreset(null);
      return;
    }
    setActivePresetLoading(true);
    fetchThemePreset(activeStubTheme)
      .then((preset) => setActiveThemePreset(preset || null))
      .catch(() => setActiveThemePreset(null))
      .finally(() => setActivePresetLoading(false));
  }, [activeStubTheme]);

  useEffect(() => {
    if (activeStubTheme) return;
    if (stubStatus?.theme) {
      setActiveStubTheme(stubStatus.theme);
    } else if (stubList.length) {
      setActiveStubTheme(stubList[0].theme);
    }
  }, [activeStubTheme, stubList, stubStatus?.theme]);

  useEffect(() => {
    if (!activeStubTheme) return;
    const stillExists = stubList.some((stub) => stub.theme === activeStubTheme);
    if (!stillExists) {
      setActiveStubTheme(stubList[0]?.theme || '');
    }
  }, [activeStubTheme, stubList]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const list = baselines.split(',').map((t) => t.trim()).filter(Boolean);
      await updateBaselineList(list);
    } finally {
      setSaving(false);
    }
  };

  const refreshLogs = useCallback(
    async (themeOverride?: string) => {
      try {
        const logs = await fetchStubLogs(themeOverride || activeStubTheme || undefined);
        setStubLogs(logs.logs || []);
      } catch {
        setStubLogs([]);
      }
    },
    [activeStubTheme],
  );

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 10000);
    return () => clearInterval(interval);
  }, [refreshLogs]);

  useEffect(() => {
    if (!activeStubTheme) return;
    refreshLogs(activeStubTheme);
  }, [activeStubTheme, refreshLogs]);

  useEffect(() => {
    if (!selectedStoreDemo) {
      setSelectedPartials([]);
      partialDemoRef.current = null;
      return;
    }
    if (partialDemoRef.current === selectedStoreDemo) return;
    const manifest = storeDemos.find((demo) => demo.id === selectedStoreDemo);
    if (!manifest) return;
    setSelectedPartials(manifest.partials || []);
    partialDemoRef.current = selectedStoreDemo;
  }, [selectedStoreDemo, storeDemos]);

  const handleStartStub = async () => {
    const themeToLaunch = (newStubTheme || '').trim() || 'demo';
    await launchStub(themeToLaunch);
    setActiveStubTheme(themeToLaunch);
    setNewStubTheme(themeToLaunch);
    await refreshStubsAndCoverage();
    await refreshLogs(themeToLaunch);
  };

  const handleStopStub = async () => {
    const targetTheme = activeStubTheme || undefined;
    await haltStub(targetTheme);
    await refreshStubsAndCoverage();
    if (targetTheme) {
      await refreshLogs(targetTheme);
    } else {
      setStubLogs([]);
    }
  };

  const handleManualRefresh = async () => {
    await refreshStubsAndCoverage();
    await refreshLogs(activeStubTheme);
  };

  const handleStartStubFromList = async (themeName: string) => {
    const trimmed = (themeName || '').trim();
    if (!trimmed) return;
    await launchStub(trimmed);
    setActiveStubTheme(trimmed);
    setNewStubTheme(trimmed);
    await refreshStubsAndCoverage();
    await refreshLogs(trimmed);
  };

  const handleStopStubFromList = async (themeName: string) => {
    if (!themeName) return;
    await haltStub(themeName);
    if (themeName === activeStubTheme) {
      setActiveStubTheme('');
      setStubLogs([]);
    }
    await refreshStubsAndCoverage();
  };

  const handleSelectStubTheme = (themeName: string) => {
    setActiveStubTheme(themeName);
    setNewStubTheme(themeName);
    refreshLogs(themeName);
  };

  const handleOpenStubPreview = (themeName: string) => {
    const stub = stubList.find((entry) => entry.theme === themeName);
    if (!stub?.port) return;
    window.open(`http://localhost:${stub.port}/page/index`, '_blank', 'noopener,noreferrer');
  };

  const handlePartialToggle = (key: string) => {
    setSelectedPartials((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  };

  const handleResetPartials = () => {
    if (!selectedStoreDemo) return;
    const manifest = storeDemos.find((demo) => demo.id === selectedStoreDemo);
    if (!manifest) return;
    setSelectedPartials(manifest.partials || []);
    partialDemoRef.current = selectedStoreDemo;
  };

  const handleToggleTwilight = async (checked: boolean) => {
    setTwilightSaving(true);
    try {
      await updateTwilightStatus(checked);
      setTwilightEnabled(checked);
    } finally {
      setTwilightSaving(false);
    }
  };

  const handleApplyStorePreset = async () => {
    if (!selectedStoreDemo) return;
    setStorePresetLoading(true);
    try {
      if (!selectedPartials.length) {
        setStorePresetMessage('Select at least one partial before applying the preset.');
        return;
      }
      let overrides: Record<string, any> | undefined;
      if (storeOverrides.trim()) {
        overrides = JSON.parse(storeOverrides);
      }
      const targetTheme = activeStubTheme || stubStatus?.theme || '';
      await applyStorePreset({
        demo: selectedStoreDemo,
        theme: targetTheme || undefined,
        overrides,
        parts: selectedPartials,
      });
      setStorePresetMessage(`Store preset "${selectedStoreDemo}" applied.`);
      setStoreDiff(null);
      await refreshStubsAndCoverage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply store preset.';
      setStorePresetMessage(message);
    } finally {
      setStorePresetLoading(false);
      setTimeout(() => setStorePresetMessage(''), 4000);
    }
  };

  const handleApplyBrandPreset = async (slug: string) => {
    if (!activeStubTheme) {
      setBrandError('Select or launch a stub before applying a brand preset.');
      return false;
    }
    setBrandError('');
    setBrandAction({ slug, status: 'pending' });
    try {
      await applyBrand(activeStubTheme, slug);
      setBrandAction({ slug, status: 'success' });
      await refreshStubsAndCoverage();
      return true;
    } catch (error) {
      setBrandAction({
        slug,
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to apply brand preset.',
      });
      return false;
    }
  };

  const handleApplyBrandPresetAndRebuild = async (slug: string) => {
    const targetTheme = activeStubTheme;
    const applied = await handleApplyBrandPreset(slug);
    if (!applied || !targetTheme) return;
    try {
      await startBuild({ theme: targetTheme, diff: false });
      setBannerMessage(`Brand applied and rebuild queued for ${targetTheme}.`);
      setTimeout(() => setBannerMessage(null), 4000);
    } catch (error) {
      setBrandError(
        error instanceof Error
          ? `Brand applied but build failed: ${error.message}`
          : 'Brand applied but build failed to queue.',
      );
    }
  };

  const currentStoreDemo = storeDemos.find((demo) => demo.id === selectedStoreDemo);
  const activeBrand = (activeThemePreset?.brand || null) as { slug?: string; name?: string; colors?: Record<string, string>; fonts?: string[] } | null;
  const activeBrandSwatches = Object.entries(activeBrand?.colors || {}).slice(0, 6);
  const sseStatusText =
    sseStatus === 'connected'
      ? 'Live sync: connected'
      : sseStatus === 'error'
        ? 'Live sync: offline'
        : 'Live sync: connecting…';
  const sseStatusColor =
    sseStatus === 'connected' ? 'bg-emerald-500' : sseStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500';
  const filteredPartials = useMemo(() => {
    if (!partialFilter.trim()) return storePartials;
    const term = partialFilter.trim().toLowerCase();
    return storePartials.filter(
      (partial) =>
        partial.key.toLowerCase().includes(term) ||
        (partial.label || '').toLowerCase().includes(term) ||
        (partial.category || '').toLowerCase().includes(term),
    );
  }, [storePartials, partialFilter]);
  const selectedPartialBadges = useMemo(
    () =>
      selectedPartials.map((key) => {
        const meta = storePartials.find((partial) => partial.key === key);
        return {
          key,
          label: meta?.label || key,
          category: meta?.category || null,
        };
      }),
    [selectedPartials, storePartials],
  );

  const handlePreviewDiff = async () => {
    if (!selectedStoreDemo) return;
    setStoreDiffLoading(true);
    setStoreDiffError('');
    try {
      if (!selectedPartials.length) {
        setStoreDiffError('Select at least one partial to preview.');
        setStoreDiffLoading(false);
        return;
      }
      const targetTheme = activeStubTheme || stubStatus?.theme || '';
      const diff = await fetchStoreDiff({
        demo: selectedStoreDemo,
        theme: targetTheme || undefined,
        parts: selectedPartials,
      });
      setStoreDiff(diff);
    } catch (error) {
      setStoreDiffError(error instanceof Error ? error.message : 'Failed to load diff.');
      setStoreDiff(null);
    } finally {
      setStoreDiffLoading(false);
    }
  };

  if (!settings) return <p className="text-sm text-slate-500">Loading settings…</p>;

  return (
    <>
      {bannerMessage && (
        <div className="fixed top-4 right-4 z-40 rounded-xl border border-emerald-200 bg-white shadow-xl shadow-emerald-200/60 px-4 py-2 text-sm text-emerald-700">
          {bannerMessage}
        </div>
      )}
      <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-lg font-semibold mb-2">Paths</h2>
          <ul className="text-sm text-slate-600 space-y-1">
            <li><strong>Input:</strong> {settings.inputDir}</li>
            <li><strong>Output:</strong> {settings.outputDir}</li>
            <li><strong>Reports:</strong> {settings.reportsDir}</li>
            <li><strong>Logs:</strong> {settings.logsDir}</li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-lg font-semibold">Baseline Defaults</h2>
          <textarea
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            rows={3}
            value={baselines}
            onChange={(e) => setBaselines(e.target.value)}
          />
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            Save Baseline List
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-2">Runtime Stub</h2>
        <p className="text-sm text-slate-500">
          Active selection: <span className="font-mono">{activeStubTheme || '—'}</span> ·{' '}
          {stubStatusLoading ? 'Checking…' : stubStatus?.running ? `Running on port ${stubStatus.port}` : 'Stopped'}
          {activeStubTheme ? (
            activePresetLoading ? (
              <> · Checking brand…</>
            ) : activeBrand ? (
              <>
                {' '}
                · <span className="inline-flex items-center gap-1 text-xs text-slate-600">Brand: {activeBrand.name || activeBrand.slug || '—'}</span>
              </>
            ) : (
              <> · No brand preset</>
            )
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={newStubTheme}
            onChange={(e) => setNewStubTheme(e.target.value)}
            placeholder="theme to launch"
          />
          <button className="btn-primary" onClick={handleStartStub} disabled={stubActionLoading}>
            Start Stub
          </button>
          <button
            className="btn-secondary"
            onClick={handleStopStub}
            disabled={stubActionLoading || !activeStubTheme || !stubStatus?.running}
          >
            Stop Stub
          </button>
          <button className="btn-ghost" onClick={handleManualRefresh}>
            Refresh
          </button>
        </div>
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Running stubs</p>
          {stubList.length ? (
            <div className="flex flex-wrap gap-2">
              {stubList.map((stub) => (
                <button
                  key={stub.theme}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    activeStubTheme === stub.theme ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'
                  }`}
                  onClick={() => setActiveStubTheme(stub.theme)}
                >
                  {stub.theme} · {stub.port}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No stubs running.</p>
          )}
        </div>
        <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-3 text-xs font-mono max-h-48 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
            Logs {activeStubTheme ? `• ${activeStubTheme}` : ''}
          </p>
          {!stubLogs.length ? <p>No logs yet.</p> : stubLogs.slice(-10).map((line, idx) => (<div key={`${line}-${idx}`}>{line}</div>))}
        </div>
      </div>
      <ThemeStubList
        themes={themes}
        stubs={stubList}
        loading={stubStatusLoading}
        actionLoading={stubActionLoading}
        activeTheme={activeStubTheme}
        previewMap={previewMap}
        previewLoading={previewMatrixLoading}
        onStart={handleStartStubFromList}
        onStop={handleStopStubFromList}
        onRefresh={handleManualRefresh}
        onSelectTheme={handleSelectStubTheme}
        onOpenPreview={handleOpenStubPreview}
        description="Launch multiple preview stubs in parallel or jump directly into a running instance."
      />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-2">Twilight Runtime</h2>
        <p className="text-sm text-slate-500">Toggle the local Twilight/NEXUS shim to mirror Salla-native components.</p>
        <label className="flex items-center gap-3 text-sm mt-3">
          <input
            type="checkbox"
            checked={twilightEnabled}
            disabled={twilightStatusLoading || twilightSaving}
            onChange={(e) => handleToggleTwilight(e.target.checked)}
          />
          {twilightStatusLoading ? 'Checking…' : twilightEnabled ? 'Enabled' : 'Disabled'}
        </label>
        <p className="text-xs text-slate-500 mt-2">
          {twilightSaving ? 'Applying…' : 'Applies instantly to the running preview stub.'}
        </p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Brand Presets</h2>
            <p className="text-xs text-slate-500">Palettes + font stacks extracted from uploaded prototypes.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className={`inline-flex h-2 w-2 rounded-full ${sseStatusColor}`} />
            <span>{sseStatusText}</span>
          </div>
          <button className="btn-ghost text-xs" onClick={refreshBrands} disabled={brandLoading}>
            {brandLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {brandError && <p className="text-xs text-rose-600">{brandError}</p>}
        <div className="border border-slate-200 rounded-xl p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Active theme preset</p>
          {activeStubTheme ? (
            activePresetLoading ? (
              <p className="text-xs text-slate-500">Loading brand preset…</p>
            ) : activeBrand ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{activeBrand.name || activeBrand.slug}</p>
                    <p className="text-[11px] text-slate-500">{activeBrand.slug || '—'}</p>
                  </div>
                  <div className="flex gap-1">
                    {activeBrandSwatches.length ? (
                      activeBrandSwatches.map(([key, value]) => (
                        <div key={`active-brand-swatch-${key}`} className="text-[10px] text-slate-500 text-center">
                          <div className="h-6 w-6 rounded-md border border-slate-200" style={{ background: value }} />
                          <span className="block truncate max-w-[3rem]">{key.replace(/^--/, '')}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No tokens</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Fonts: {activeBrand.fonts?.length ? activeBrand.fonts.slice(0, 4).join(', ') : '—'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">No brand preset applied to {activeStubTheme}.</p>
            )
          ) : (
            <p className="text-xs text-slate-500">Select a stub theme to view its applied brand preset.</p>
          )}
        </div>
        {brandLoading ? (
          <p className="text-xs text-slate-500">Loading brand presets…</p>
        ) : brands.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {brands.map((brand) => {
              const colors = Object.entries(brand.colors || {}).slice(0, 5);
              const isApplying = brandAction?.slug === brand.slug && brandAction?.status === 'pending';
              const isApplied = activeBrand?.slug === brand.slug;
              const buttonLabel = isApplied
                ? 'Applied'
                : isApplying
                  ? 'Applying…'
                  : activeStubTheme
                    ? `Apply to ${activeStubTheme}`
                    : 'Select a theme';
              const statusMessage =
                brandAction?.slug === brand.slug && brandAction?.status === 'error'
                  ? brandAction.message || 'Failed to apply preset.'
                  : brandAction?.slug === brand.slug && brandAction?.status === 'success'
                    ? 'Preset applied'
                    : isApplied
                      ? 'Currently applied'
                      : null;
              return (
                <div
                  key={brand.slug}
                  className={`border rounded-xl p-3 space-y-2 ${
                    isApplied ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{brand.name}</p>
                      <p className="text-[11px] text-slate-500">{brand.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      {colors.map(([key, value]) => (
                        <div key={`${brand.slug}-${key}`} className="text-[10px] text-slate-500 text-center">
                          <div className="h-6 w-6 rounded-md border border-slate-200" style={{ background: value }} />
                          <span className="block truncate max-w-[2.5rem]">{key.replace(/^--/, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Fonts: {brand.fonts.length ? brand.fonts.slice(0, 3).join(', ') : '—'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => handleApplyBrandPreset(brand.slug)}
                      disabled={!activeStubTheme || isApplying || isApplied}
                    >
                      {buttonLabel}
                    </button>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => handleApplyBrandPresetAndRebuild(brand.slug)}
                      disabled={!activeStubTheme || isApplying}
                    >
                      Apply + Rebuild
                    </button>
                    {statusMessage && (
                      <span
                        className={`text-[11px] ${
                          brandAction?.status === 'error' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {statusMessage}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            No brand presets yet. Drop a design HTML and run <code className="font-mono">npm run brand:extract</code>.
          </p>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-1">Store Presets</h2>
        <p className="text-xs text-slate-500">Swap demo data (products, hero, locales) without rebuilding the theme.</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedStoreDemo}
            onChange={(e) => setSelectedStoreDemo(e.target.value)}
          >
            {storeDemos.map((demo) => (
              <option key={demo.id} value={demo.id}>
                {demo.name}
              </option>
            ))}
          </select>
          <button className="btn-primary text-xs" onClick={handleApplyStorePreset} disabled={storePresetLoading || !selectedStoreDemo}>
            {storePresetLoading ? 'Applying…' : 'Apply Preset'}
          </button>
          <button className="btn-secondary text-xs" onClick={handlePreviewDiff} disabled={storeDiffLoading || !selectedStoreDemo}>
            {storeDiffLoading ? 'Loading…' : 'Preview Diff'}
          </button>
        </div>
        {currentStoreDemo ? (
          <p className="text-xs text-slate-500">
            Theme: {currentStoreDemo.meta?.theme || '—'} • Locale: {currentStoreDemo.meta?.locale || '—'} • Currency:{' '}
            {currentStoreDemo.meta?.currency || '—'}
          </p>
        ) : null}
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          rows={3}
          placeholder='Optional overrides JSON (e.g. {"store":{"name":"Custom Demo"}})'
          value={storeOverrides}
          onChange={(e) => setStoreOverrides(e.target.value)}
        />
        <div className="border border-slate-100 rounded-xl bg-slate-50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-slate-700">Partial Selection</p>
              <p className="text-xs text-slate-500">Choose which JSON blocks to compose into the demo store.</p>
            </div>
            <button className="btn-ghost text-xs" onClick={handleResetPartials}>
              Reset to Demo Defaults
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
              placeholder="Search partials (e.g. hero/tech)"
              value={partialFilter}
              onChange={(e) => setPartialFilter(e.target.value)}
            />
            <span className="text-xs text-slate-500">Selected: {selectedPartials.length}</span>
          </div>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
            {filteredPartials.length ? (
              filteredPartials.slice(0, 60).map((partial) => {
                const chosen = selectedPartials.includes(partial.key);
                return (
                  <label
                    key={partial.key}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                      chosen ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-emerald-500"
                      checked={chosen}
                      onChange={() => handlePartialToggle(partial.key)}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{partial.label}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {partial.key} {partial.category ? `• ${partial.category}` : ''}
                      </p>
                    </div>
                  </label>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 px-3 py-2">No partials match this filter.</p>
            )}
            {filteredPartials.length > 60 && (
              <p className="text-xs text-slate-400 px-3 py-2">Refine your search to see more partials.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPartialBadges.length ? (
              selectedPartialBadges.map((badge) => (
                <span
                  key={badge.key}
                  className="px-2 py-1 text-xs rounded-full bg-slate-200 text-slate-700 flex items-center gap-2"
                >
                  {badge.label}
                  <button
                    type="button"
                    className="text-slate-500 hover:text-rose-500"
                    onClick={() => handlePartialToggle(badge.key)}
                    aria-label={`Remove ${badge.label}`}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-500">No partials selected.</p>
            )}
          </div>
        </div>
        {storePresetMessage && <p className="text-xs text-emerald-600">{storePresetMessage}</p>}
      </div>
      {storeDiffError && <p className="text-xs text-rose-600">{storeDiffError}</p>}
      {storeDiff && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Diff Preview</h3>
          <div className="text-xs text-slate-500">
            <p>
              Current preset: {storeDiff.current?.preset?.name || storeDiff.current?.preset?.demo || 'Legacy'} • Next preset:{' '}
              {storeDiff.next?.preset?.name || storeDiff.demo}
            </p>
            <p>Theme: {storeDiff.theme}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-semibold text-slate-600 mb-1">Current Store</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>Name: {storeDiff.current?.store?.name || '—'}</li>
                <li>Locale: {storeDiff.current?.store?.language || '—'}</li>
                <li>Currency: {storeDiff.current?.store?.currency || '—'}</li>
                <li>Products: {storeDiff.current?.productCount || 0}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-600 mb-1">Next Store</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>Name: {storeDiff.next?.store?.name || '—'}</li>
                <li>Locale: {storeDiff.next?.store?.language || '—'}</li>
                <li>Currency: {storeDiff.next?.store?.currency || '—'}</li>
                <li>Products: {storeDiff.next?.productCount || 0}</li>
              </ul>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            <p className="font-semibold text-slate-600">Partial Changes</p>
            <p>Added: {storeDiff.partialDiff?.added?.length ? storeDiff.partialDiff.added.join(', ') : 'None'}</p>
            <p>Removed: {storeDiff.partialDiff?.removed?.length ? storeDiff.partialDiff.removed.join(', ') : 'None'}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-2">CI / Automation</h2>
        <p className="text-sm text-slate-500">Baseline logs and metrics are written to /logs/baseline and /reports/baseline-metrics.md for easy pickup by CI pipelines.</p>
      </div>
    </div>
    </>
  );
}

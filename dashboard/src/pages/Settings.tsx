import { useCallback, useEffect, useState } from 'react';
import {
  fetchSettings,
  updateBaselineList,
  fetchStubLogs,
  fetchStoreDemos,
  applyStorePreset,
  type StoreDemo,
  fetchStoreDiff,
  fetchTwilightStatus,
  updateTwilightStatus,
} from '../api/system';
import { useRuntimeStub } from '../hooks/useRuntimeStub';

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
  const [stubTheme, setStubTheme] = useState('demo');
  const [stubLogs, setStubLogs] = useState<string[]>([]);
  const [storeDemos, setStoreDemos] = useState<StoreDemo[]>([]);
  const [selectedStoreDemo, setSelectedStoreDemo] = useState('electronics');
  const [storeOverrides, setStoreOverrides] = useState('');
  const [storePresetMessage, setStorePresetMessage] = useState('');
  const [storePresetLoading, setStorePresetLoading] = useState(false);
  const [twilightEnabled, setTwilightEnabled] = useState(true);
  const [twilightStatusLoading, setTwilightStatusLoading] = useState(true);
  const [twilightSaving, setTwilightSaving] = useState(false);
  const [storeDiff, setStoreDiff] = useState<any | null>(null);
  const [storeDiffLoading, setStoreDiffLoading] = useState(false);
  const [storeDiffError, setStoreDiffError] = useState('');
  const {
    status: stubStatus,
    loading: stubStatusLoading,
    actionLoading: stubActionLoading,
    startStub: launchStub,
    stopStub: haltStub,
    refresh: refreshStubStatus,
  } = useRuntimeStub({ pollMs: 8000 });

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
    fetchTwilightStatus()
      .then((data) => setTwilightEnabled(Boolean(data.enabled)))
      .catch(() => undefined)
      .finally(() => setTwilightStatusLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const list = baselines.split(',').map((t) => t.trim()).filter(Boolean);
      await updateBaselineList(list);
    } finally {
      setSaving(false);
    }
  };

  const refreshLogs = useCallback(async () => {
    try {
      const logs = await fetchStubLogs();
      setStubLogs(logs.logs || []);
    } catch {
      setStubLogs([]);
    }
  }, []);

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 10000);
    return () => clearInterval(interval);
  }, [refreshLogs]);

  const handleStartStub = async () => {
    await launchStub(stubTheme || 'demo');
    await refreshLogs();
  };

  const handleStopStub = async () => {
    await haltStub();
    await refreshLogs();
  };

  const handleManualRefresh = async () => {
    await refreshStubStatus();
    await refreshLogs();
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
      let overrides: Record<string, any> | undefined;
      if (storeOverrides.trim()) {
        overrides = JSON.parse(storeOverrides);
      }
      await applyStorePreset({
        demo: selectedStoreDemo,
        theme: stubTheme || undefined,
        overrides,
      });
      setStorePresetMessage(`Store preset "${selectedStoreDemo}" applied.`);
      setStoreDiff(null);
      await refreshStubStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply store preset.';
      setStorePresetMessage(message);
    } finally {
      setStorePresetLoading(false);
      setTimeout(() => setStorePresetMessage(''), 4000);
    }
  };

  const currentStoreDemo = storeDemos.find((demo) => demo.id === selectedStoreDemo);

  const handlePreviewDiff = async () => {
    if (!selectedStoreDemo) return;
    setStoreDiffLoading(true);
    setStoreDiffError('');
    try {
      const diff = await fetchStoreDiff({ demo: selectedStoreDemo, theme: stubTheme || undefined });
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
          Status:{' '}
          {stubStatusLoading
            ? 'Checking…'
            : stubStatus?.running
              ? `Running on port ${stubStatus.port}${stubStatus.theme ? ` • ${stubStatus.theme}` : ''}`
              : 'Stopped'}
        </p>
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={stubTheme}
            onChange={(e) => setStubTheme(e.target.value)}
            placeholder="theme name"
          />
          <button className="btn-primary" onClick={handleStartStub} disabled={stubActionLoading}>
            Start Stub
          </button>
          <button className="btn-secondary" onClick={handleStopStub} disabled={stubActionLoading || !stubStatus?.running}>
            Stop Stub
          </button>
          <button className="btn-ghost" onClick={handleManualRefresh}>
            Refresh
          </button>
        </div>
        <div className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-3 text-xs font-mono max-h-48 overflow-y-auto">
          {!stubLogs.length ? <p>No logs yet.</p> : stubLogs.slice(-10).map((line, idx) => (<div key={`${line}-${idx}`}>{line}</div>))}
        </div>
      </div>
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
  );
}

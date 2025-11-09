import { useEffect, useMemo, useState } from 'react';
import type { ThemeRecord } from '../lib/api';
import { runDeploy, runPackage } from '../lib/api';
import { useThemesCatalog } from '../hooks/useThemesCatalog';
import { runRuntimeScenario } from '../api/system';
import { useScenarioStream, type ScenarioSession } from '../hooks/useScenarioStream';

type ActionStatus = {
  message: string;
  variant: 'info' | 'success' | 'error';
};

function PreviewCard({
  record,
  onPackage,
  onDeploy,
  onSmokeTest,
  busyPackage,
  busyDeploy,
  busySmoke,
  smokeStatus,
  status,
}: {
  record: ThemeRecord;
  onPackage: (theme: string) => void;
  onDeploy: (theme: string) => void;
  onSmokeTest: (theme: string) => void;
  busyPackage: boolean;
  busyDeploy: boolean;
  busySmoke: boolean;
  smokeStatus?: ScenarioSession | null;
  status?: ActionStatus;
}) {
  const manifest = record.manifest;
  const preview = manifest?.preview;
  const hasPreview = Boolean(preview?.url);
  const delivery = manifest?.delivery;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Preview</p>
          <h3 className="text-lg font-semibold text-slate-900">{record.name}</h3>
          <p className="text-xs text-slate-500">
            Built {manifest?.buildTime ? new Date(manifest.buildTime).toLocaleString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPackage(record.name)}
            disabled={busyPackage}
            className="rounded-full border border-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-50"
          >
            {busyPackage ? 'Packaging…' : 'Package'}
          </button>
          <button
            type="button"
            onClick={() => onDeploy(record.name)}
            disabled={busyDeploy}
            className="rounded-full border border-slate-400 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-900 hover:text-white disabled:opacity-50"
          >
            {busyDeploy ? 'Deploying…' : 'Deploy'}
          </button>
          <button
            type="button"
            onClick={() => onSmokeTest(record.name)}
            disabled={busySmoke}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-900 hover:text-white disabled:opacity-50"
          >
            {busySmoke ? 'Running…' : 'Smoke Test'}
          </button>
        </div>
      </div>
      {status?.message && (
        <div
          className={`px-5 py-2 text-xs ${
            status.variant === 'error'
              ? 'bg-rose-50 text-rose-700'
              : status.variant === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-700'
          }`}
        >
          {status.message}
        </div>
      )}
      {hasPreview ? (
        <iframe
          src={preview?.url || undefined}
          title={`${record.name}-preview`}
          className="h-[360px] w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-slate-100 text-sm text-slate-500">
          Preview not available. Build first.
        </div>
      )}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex flex-col gap-1">
        <span>
          URL:{' '}
          {preview?.url ? (
            <a href={preview.url} target="_blank" rel="noreferrer" className="text-slate-900 underline">
              {preview.url}
            </a>
          ) : (
            '—'
          )}
        </span>
        <span>
          Port: <strong>{preview?.port ?? '—'}</strong>
        </span>
        {delivery?.package && (
          <span>
            Package:{' '}
            <code className="text-slate-600">{delivery.package}</code>{' '}
            {delivery.packageExists ? (
              <span className="text-emerald-600">ready</span>
            ) : (
              <span className="text-slate-400">not generated yet</span>
            )}
          </span>
        )}
        {manifest?.reports?.extended && (
          <span className="text-[11px] text-slate-400">
            Extended report: <code>{manifest.reports.extended}</code>
          </span>
        )}
        <span>
          Smoke status:{' '}
          <strong
            className={
              smokeStatus?.status === 'succeeded'
                ? 'text-emerald-600'
                : smokeStatus?.status === 'failed'
                    ? 'text-rose-600'
                    : 'text-slate-600'
            }
          >
            {smokeStatus?.status || 'Idle'}
          </strong>
        </span>
      </div>
    </div>
  );
}

export default function PreviewDelivery() {
  const { themes, loading, error, refresh } = useThemesCatalog();
  const [busy, setBusy] = useState<{ theme: string; action: 'package' | 'deploy' | 'smoke' } | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, ActionStatus>>({});
  const { sessions } = useScenarioStream();

  const handlePackage = async (theme: string) => {
    setBusy({ theme, action: 'package' });
    setStatusMap((prev) => ({ ...prev, [theme]: { message: 'Packaging…', variant: 'info' } }));
    try {
      await runPackage(theme);
      setStatusMap((prev) => ({ ...prev, [theme]: { message: 'Package job enqueued.', variant: 'success' } }));
    } catch (err) {
      setStatusMap((prev) => ({
        ...prev,
        [theme]: { message: err instanceof Error ? err.message : 'Failed to package.', variant: 'error' },
      }));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const handleDeploy = async (theme: string) => {
    setBusy({ theme, action: 'deploy' });
    setStatusMap((prev) => ({ ...prev, [theme]: { message: 'Deploying via Salla CLI…', variant: 'info' } }));
    try {
      await runDeploy(theme);
      setStatusMap((prev) => ({ ...prev, [theme]: { message: 'Deploy command enqueued.', variant: 'success' } }));
    } catch (err) {
      setStatusMap((prev) => ({
        ...prev,
        [theme]: { message: err instanceof Error ? err.message : 'Failed to deploy.', variant: 'error' },
      }));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const handleSmokeTest = async (theme: string) => {
    setBusy({ theme, action: 'smoke' });
    // Smoke test runs via runtime scenario chain; UI just tracks enqueue state.
    try {
      await runRuntimeScenario({ theme, chain: ['smoke'] });
      setStatusMap((prev) => ({ ...prev, [theme]: { message: 'Smoke test enqueued.', variant: 'success' } }));
    } catch (error) {
      setStatusMap((prev) => ({
        ...prev,
        [theme]: { message: error instanceof Error ? error.message : 'Failed to run smoke test.', variant: 'error' },
      }));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const scenarioMap = useMemo(() => {
    const grouped: Record<string, ScenarioSession> = {};
    sessions.forEach((session) => {
      grouped[session.theme] = session;
    });
    return grouped;
  }, [sessions]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Preview Mode</p>
          <h2 className="text-2xl font-semibold text-slate-900">Preview &amp; Delivery</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Each card reads the per-theme manifest to load the correct runtime iframe. Package operations enqueue service
            jobs—React stays read-only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
        >
          Refresh Previews
        </button>
      </header>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading previews…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {themes.map((theme) => (
            <PreviewCard
              key={theme.name}
              record={theme}
              onPackage={handlePackage}
              onDeploy={handleDeploy}
              onSmokeTest={handleSmokeTest}
              busyPackage={Boolean(busy && busy.theme === theme.name && busy.action === 'package')}
              busyDeploy={Boolean(busy && busy.theme === theme.name && busy.action === 'deploy')}
              busySmoke={Boolean(busy && busy.theme === theme.name && busy.action === 'smoke')}
              smokeStatus={scenarioMap[theme.name]}
              status={statusMap[theme.name]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

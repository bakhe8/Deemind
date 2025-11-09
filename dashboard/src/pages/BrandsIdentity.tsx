import { useMemo } from 'react';
import type { ThemeRecord } from '../lib/api';
import { useThemesCatalog } from '../hooks/useThemesCatalog';

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function RoutesList({ routes }: { routes?: string[] }) {
  if (!routes?.length) {
    return <p className="text-xs text-slate-500">No preview routes captured yet.</p>;
  }
  const display = routes.slice(0, 4);
  const remaining = routes.length - display.length;
  return (
    <div className="flex flex-wrap gap-2">
      {display.map((route) => (
        <span
          key={route}
          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
        >
          {route}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[11px] text-slate-500">+{remaining} more</span>
      )}
    </div>
  );
}

function IdentityCard({ record }: { record: ThemeRecord }) {
  const manifest = record.manifest;
  return (
    <div className="rounded-2xl bg-white/90 p-5 shadow-sm ring-1 ring-slate-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Theme</p>
          <h3 className="text-xl font-semibold text-slate-900">{record.name}</h3>
          <p className="text-xs text-slate-500">Last build: {formatDate(manifest?.buildTime || manifest?.timestamp || record.updated)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Status</p>
          <p className={`text-sm font-semibold ${manifest ? 'text-emerald-600' : 'text-slate-500'}`}>
            {manifest ? 'Built' : 'Not built'}
          </p>
          {manifest?.version && (
            <p className="text-[11px] text-slate-400">v{manifest.version}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase text-slate-400">Pages</p>
          <p className="text-base font-semibold text-slate-900">{manifest?.pages ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-slate-400">Components</p>
          <p className="text-base font-semibold text-slate-900">{manifest?.components ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-slate-400">Warnings</p>
          <p className={`text-base font-semibold ${manifest?.warnings ? 'text-amber-600' : 'text-slate-900'}`}>
            {manifest?.warnings ?? 0}
          </p>
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase text-slate-400 mb-1">Preview Routes</p>
        <RoutesList routes={manifest?.preview?.routes} />
      </div>
      {manifest?.preview?.url && (
        <p className="text-xs text-slate-500">
          Preview:{' '}
          <span className="font-mono text-slate-700">{manifest.preview.url}</span>
        </p>
      )}
    </div>
  );
}

export default function BrandsIdentity() {
  const { themes, loading, error, refresh } = useThemesCatalog();
  const totalBuilt = useMemo(() => themes.filter((t) => Boolean(t.manifest)).length, [themes]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Creative Mode</p>
          <h2 className="text-2xl font-semibold text-slate-900">Brands &amp; Identity</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Read-only view of every theme identity in the factory. This surface mirrors `/core/brands/*`
            and the latest build manifest so you can review DNA, metadata, and preview routes without touching source files.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-medium">
            {totalBuilt}/{themes.length || '—'} built
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
          >
            Refresh
          </button>
        </div>
      </header>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading themes…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {themes.map((theme) => (
            <IdentityCard key={theme.name} record={theme} />
          ))}
        </div>
      )}
    </section>
  );
}

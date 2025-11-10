// @reuse-from: dashboard/src/lib/api-brand.ts
// @description: Standalone creative surface for importing, previewing, and applying brand DNA.
import { useEffect, useState } from 'react';
import { applyBrand, getBrand, importBrand, listBrands, type BrandSummary } from '../lib/api-brand';
import { triggerBuild } from '../lib/api';

type BrandListItem = BrandSummary;

export default function BrandWizardView() {
  const [items, setItems] = useState<BrandListItem[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [brand, setBrand] = useState<any>(null);
  const [theme, setTheme] = useState('demo');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    const payload = await listBrands();
    setItems(payload);
    if (payload.length && !selected) {
      setSelected(payload[0].id);
    }
  }

  useEffect(() => {
    refresh().catch((error) => setToast(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    if (!selected) {
      setBrand(null);
      return;
    }
    getBrand(selected)
      .then((data) => setBrand(data))
      .catch((error) => setToast(error instanceof Error ? error.message : String(error)));
  }, [selected]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      const id = json.id || `brand-${Date.now()}`;
      setBusy(true);
      await importBrand(id, json);
      setToast(`Imported ${id}`);
      await refresh();
      setSelected(id);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!selected) {
      setToast('Pick a brand first');
      return;
    }
    if (!theme) {
      setToast('Specify a theme');
      return;
    }
    try {
      setBusy(true);
      await applyBrand(selected, theme);
      setToast(`Applied '${selected}' → ${theme}. Queuing build…`);
      await triggerBuild(theme, ['--auto']);
      setToast(`Applied '${selected}' and queued build for ${theme}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Apply failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Creative Layer</p>
        <h1 className="text-2xl font-semibold text-slate-900">Brand Wizard</h1>
        <p className="text-sm text-slate-500">
          Manage brand DNA without touching manufacturing code. All mutations flow through `/api/brands/*`.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Your Brands</h2>
            <input type="file" accept="application/json" onChange={handleImport} disabled={busy} />
          </div>
          <ul className="space-y-2 text-sm">
            {items.length === 0 && <li className="text-slate-500">No brand DNA yet — import JSON to begin.</li>}
            {items.map((item) => (
              <li
                key={item.id}
                className={`cursor-pointer rounded-lg border px-3 py-2 ${
                  selected === item.id ? 'border-slate-900 bg-slate-900/5' : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelected(item.id)}
              >
                <p className="font-semibold text-slate-900">{item.meta?.name || item.id}</p>
                <p className="text-xs text-slate-500">
                  colors: {item.meta?.colors} · typography: {item.meta?.typography}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Preview Identity</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs"
                placeholder="theme (e.g., demo)"
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={busy}
                className="rounded-full border border-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-50"
              >
                Apply to Theme
              </button>
            </div>
          </div>
          {brand ? (
            <pre className="max-h-[24rem] overflow-auto rounded-xl bg-slate-950/90 p-4 text-xs text-slate-100">
              {JSON.stringify(brand.identity, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">Select a brand to preview its identity.</p>
          )}
        </div>
      </section>

      {toast && (
        <div className="rounded-full bg-slate-900/90 px-4 py-2 text-center text-xs font-semibold text-white">{toast}</div>
      )}
    </div>
  );
}

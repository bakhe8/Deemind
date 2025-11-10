// @reuse-from: dashboard/src/api/client.ts
// @description: Minimal client for the isolated Brand Wizard endpoints.
/**
 * @layer Dashboard (UI-only)
 * This module must never access filesystem or child_process.
 * All mutations occur via REST APIs exposed by service/server.ts.
 */
import { apiFetch } from '../api';

export type BrandSummary = {
  id: string;
  file: string;
  preset: any;
  meta: {
    name: string;
    colors: string;
    typography: string;
  };
};

export async function listBrands(): Promise<BrandSummary[]> {
  const res = await apiFetch('/api/brands');
  const payload = await res.json();
  const items = payload.data?.items ?? [];
  return items.map((item: any) => {
    const identity = item.preset?.identity || {};
    const colorPalette = identity.colorPalette || {};
    const typography = identity.typography || {};
    return {
      id: item.id,
      file: item.file,
      preset: item.preset,
      meta: {
        name: identity.name || item.id,
        colors: Object.keys(colorPalette).join(', ') || 'n/a',
        typography: Object.values(typography).join(', ') || 'n/a',
      },
    };
  });
}

export async function getBrand(id: string) {
  const res = await apiFetch(`/api/brands/${encodeURIComponent(id)}`);
  const payload = await res.json();
  return payload.data?.brand ?? null;
}

export async function importBrand(id: string, brand: any) {
  const res = await apiFetch(`/api/brands/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify(brand),
  });
  return res.json();
}

export async function applyBrand(id: string, theme: string) {
  const res = await apiFetch(`/api/brands/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    body: JSON.stringify({ theme }),
  });
  return res.json();
}

export async function exportBrand(id: string) {
  const res = await apiFetch(`/api/brands/${encodeURIComponent(id)}/export`);
  return res.text();
}

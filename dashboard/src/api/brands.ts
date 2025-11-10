/**
 * @layer Dashboard (UI-only)
 * This module must never access filesystem or child_process.
 * All mutations occur via REST APIs exposed by service/server.ts.
 */
import { apiFetch } from './client';

export type BrandPreset = {
  slug: string;
  name: string;
  colors: Record<string, string>;
  fonts: string[];
  source?: { html?: string; extractedAt?: string };
};

async function jsonFetch(url: string, options?: RequestInit) {
  const res = await apiFetch(url, options);
  return res.json();
}

export async function fetchBrands() {
  const payload = await jsonFetch('/api/brands');
  const items = payload.data?.items ?? [];
  return {
    brands: items.map((item: any) => ({
      slug: item.preset?.id || item.id,
      name: item.preset?.identity?.name || item.id,
      colors: item.preset?.identity?.colorPalette || {},
      fonts: item.preset?.identity?.typography ? Object.values(item.preset.identity.typography) : [],
      source: item.preset?.source,
    })) as BrandPreset[],
  };
}

export async function fetchBrand(slug: string) {
  const payload = await jsonFetch(`/api/brands/${encodeURIComponent(slug)}`);
  return payload.data?.brand ?? null;
}

export async function createBrand(preset: BrandPreset) {
  return jsonFetch('/api/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
}

export async function updateBrand(preset: BrandPreset) {
  return jsonFetch(`/api/brands/${encodeURIComponent(preset.slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
}

export async function applyBrand(theme: string, brand: string) {
  return jsonFetch(`/api/brands/${encodeURIComponent(brand)}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
}

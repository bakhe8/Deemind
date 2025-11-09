import { apiJson } from './client';

export type BrandPreset = {
  slug: string;
  name: string;
  colors: Record<string, string>;
  fonts: string[];
  source?: { html?: string; extractedAt?: string };
};

export async function fetchBrands() {
  return apiJson<{ brands: BrandPreset[] }>('/api/brands');
}

export async function applyBrand(theme: string, brand: string) {
  return apiJson<{ ok: boolean; preset: BrandPreset }>('/api/theme/apply-brand', {
    method: 'POST',
    body: JSON.stringify({ theme, brand }),
  });
}

// @reuse-from: dashboard/src/api/client.ts
// @description: Minimal client for the isolated Brand Wizard endpoints.
export async function listBrands() {
  const res = await fetch('/api/brands');
  if (!res.ok) throw new Error(await res.text());
  const payload = await res.json();
  return payload.data?.items ?? [];
}

export async function getBrand(id: string) {
  const res = await fetch(`/api/brands/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await res.text());
  const payload = await res.json();
  return payload.data?.brand ?? null;
}

export async function importBrand(id: string, brand: any) {
  const res = await fetch('/api/brands/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, brand }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function applyBrand(id: string, theme: string) {
  const res = await fetch(`/api/brands/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportBrand(id: string) {
  const res = await fetch(`/api/brands/${encodeURIComponent(id)}/export`);
  if (!res.ok) throw new Error(await res.text());
  return res.text();
}

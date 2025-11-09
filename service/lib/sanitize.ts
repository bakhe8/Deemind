// @reuse-from: service/server.ts
// @description: Shared sanitizers to prevent duplicate helper definitions.
export function sanitizeThemeName(raw?: string) {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

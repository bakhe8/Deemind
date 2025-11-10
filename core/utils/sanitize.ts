export function sanitizeThemeName(raw?: string) {
  if (!raw) return '';
  return raw.toLowerCase().replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function sanitizeSlug(raw?: string) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

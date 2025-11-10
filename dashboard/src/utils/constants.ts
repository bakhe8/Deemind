const win: Record<string, unknown> =
  typeof window !== 'undefined' ? ((window as any) ?? {}) : {};

export const SERVICE_URL =
  (import.meta.env.VITE_SERVICE_URL as string) || (win.__SERVICE_URL__ as string) || 'http://localhost:5757';

const rawBrandToggle =
  (import.meta.env.VITE_ENABLE_BRANDS as string) ??
  (typeof process !== 'undefined' && process?.env ? process.env.VITE_ENABLE_BRANDS : undefined) ??
  (win.__ENABLE_BRANDS__ as string) ??
  'true';

export const ENABLE_BRANDS =
  String(rawBrandToggle).toLowerCase() === 'true' || rawBrandToggle === true;

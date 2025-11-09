export const SERVICE_URL =
  (import.meta.env.VITE_SERVICE_URL as string) || (window as any).__SERVICE_URL__ || 'http://localhost:5757';

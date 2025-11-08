/**
 * Thin compatibility wrapper. The canonical Salla adapter now lives in tools/adapter.js.
 * Import and re-export here to avoid duplication and keep older imports working.
 */
export { adaptToSalla } from './adapter.js';

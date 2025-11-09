import { useEffect } from 'react';

export type BrandWatcherStatus = 'connecting' | 'connected' | 'error';

export function useBrandWatcher(onRefresh: () => void, onStatus?: (status: BrandWatcherStatus) => void) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return undefined;
    }
    onStatus?.('connecting');
    const es = new EventSource('/api/sse');
    es.onopen = () => onStatus?.('connected');
    es.onerror = () => onStatus?.('error');
    const handler = () => onRefresh();
    es.addEventListener('brand-added', handler);
    es.addEventListener('brand-updated', handler);
    es.addEventListener('brand-removed', handler);
    es.addEventListener('brand-applied', handler);
    return () => {
      es.removeEventListener('brand-added', handler);
      es.removeEventListener('brand-updated', handler);
      es.removeEventListener('brand-removed', handler);
      es.removeEventListener('brand-applied', handler);
      es.close();
    };
  }, [onRefresh, onStatus]);
}

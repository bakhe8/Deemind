import { useCallback, useEffect, useState } from 'react';
import type { ThemeRecord } from '../lib/api';
import { getThemes } from '../lib/api';

export function useThemesCatalog(pollMs?: number) {
  const [themes, setThemes] = useState<ThemeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const next = await getThemes();
      setThemes(next);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load themes';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { themes, loading, error, refresh };
}

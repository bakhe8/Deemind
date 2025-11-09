import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPreviewMatrix, type PreviewMatrixEntry } from '../api/themes';

type Options = {
  pollMs?: number | null;
};

type PreviewMap = Record<string, PreviewMatrixEntry | undefined>;

export function usePreviewMatrix(options: Options = {}) {
  const { pollMs = null } = options;
  const [entries, setEntries] = useState<PreviewMatrixEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPreviewMatrix();
      setEntries(res.previews || []);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load preview coverage.';
      setError(reason);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return undefined;
  }, [refresh]);

  const map: PreviewMap = useMemo(() => {
    const next: PreviewMap = {};
    entries.forEach((entry) => {
      next[entry.theme] = entry;
    });
    return next;
  }, [entries]);

  return {
    entries,
    map,
    loading,
    error,
    refresh,
  };
}

export type { PreviewMatrixEntry, PreviewMap };

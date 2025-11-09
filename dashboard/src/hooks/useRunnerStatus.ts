import { useEffect, useState, useCallback } from 'react';
import { fetchStatus } from '../api/system';
import type { QueueItem } from '../store/useDashboardStore';

export type RunnerStatus = {
  current: QueueItem | null;
  queue: QueueItem[];
};

export function useRunnerStatus(pollMs = 6000) {
  const [status, setStatus] = useState<RunnerStatus>({ current: null, queue: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchStatus();
      setStatus({
        current: response.current || null,
        queue: Array.isArray(response.queue) ? response.queue : [],
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load runner status.';
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!pollMs) return undefined;
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [pollMs, refresh]);

  return { status, loading, error, refresh };
}


import { useCallback, useEffect, useState } from 'react';
import { fetchRunJobs } from '../api/system';
import type { JobStatus } from '../lib/contracts';

type UseJobHistoryOptions = {
  pollMs?: number;
};

export function useJobHistory(options: UseJobHistoryOptions = {}) {
  const { pollMs = null } = options;
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRunJobs();
      setJobs(response.jobs || []);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load job history.';
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return undefined;
  }, [refresh]);

  return { jobs, loading, error, refresh };
}

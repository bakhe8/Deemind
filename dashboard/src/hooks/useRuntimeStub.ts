import { useCallback, useEffect, useState } from 'react';
import { fetchStubStatus, startStub as startStubApi, stopStub as stopStubApi, resetStubState as resetStubStateApi } from '../api/system';

export type StubStatus = { running: boolean; theme: string | null; port: number };

type Options = {
  pollMs?: number;
};

export function useRuntimeStub(options: Options = {}) {
  const { pollMs = 6000 } = options;
  const [status, setStatus] = useState<StubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchStubStatus();
      setStatus(next);
    } catch {
      setStatus(null);
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

  const startStub = useCallback(
    async (theme: string) => {
      if (!theme) return;
      setActionLoading(true);
      try {
        await startStubApi(theme);
        await refresh();
      } finally {
        setActionLoading(false);
      }
    },
    [refresh],
  );

  const stopStub = useCallback(async () => {
    setActionLoading(true);
    try {
      await stopStubApi();
      await refresh();
    } finally {
      setActionLoading(false);
    }
  }, [refresh]);

  const resetState = useCallback(
    async (theme?: string) => {
      const target = theme || status?.theme || '';
      if (!target) return;
      setResetting(true);
      try {
        await resetStubStateApi(target);
        await refresh();
      } finally {
        setResetting(false);
      }
    },
    [refresh, status?.theme],
  );

  return {
    status,
    loading,
    actionLoading,
    resetting,
    refresh,
    startStub,
    stopStub,
    resetState,
  };
}

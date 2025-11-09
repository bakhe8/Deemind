import { useCallback, useEffect, useState } from 'react';
import {
  fetchStubStatus,
  fetchStubList,
  startStub as startStubApi,
  stopStub as stopStubApi,
  resetStubState as resetStubStateApi,
} from '../api/system';
import type { RuntimeStubInfo } from '../api/system';

export type StubStatus = { running: boolean; theme: string | null; port: number };

type Options = {
  pollMs?: number;
  theme?: string;
};

export function useRuntimeStub(options: Options = {}) {
  const { pollMs = 6000, theme } = options;
  const [status, setStatus] = useState<StubStatus | null>(null);
  const [stubs, setStubs] = useState<RuntimeStubInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [selected, list] = await Promise.all([fetchStubStatus(theme), fetchStubList()]);
      setStatus(selected);
      setStubs(list.stubs || []);
    } catch (error) {
      setStatus(null);
      setStubs([]);
    } finally {
      setLoading(false);
    }
  }, [theme]);

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

  const stopStub = useCallback(
    async (targetTheme?: string) => {
      setActionLoading(true);
      try {
        await stopStubApi(targetTheme || theme || status?.theme || undefined);
        await refresh();
      } finally {
        setActionLoading(false);
      }
    },
    [refresh, status?.theme, theme],
  );

  const resetState = useCallback(
    async (themeOverride?: string) => {
      const target = themeOverride || status?.theme || theme || '';
      if (!target) return;
      setResetting(true);
      try {
        await resetStubStateApi(target);
        await refresh();
      } finally {
        setResetting(false);
      }
    },
    [refresh, status?.theme, theme],
  );

  return {
    status,
    stubs,
    loading,
    actionLoading,
    resetting,
    refresh,
    startStub,
    stopStub,
    resetState,
  };
}

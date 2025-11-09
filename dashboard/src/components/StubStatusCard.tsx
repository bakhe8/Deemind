import { useEffect, useMemo, useState } from 'react';
import { useRuntimeStub } from '../hooks/useRuntimeStub';

type Props = {
  defaultTheme?: string;
  allowThemeInput?: boolean;
  title?: string;
  description?: string;
  pollMs?: number;
};

export default function StubStatusCard({
  defaultTheme = '',
  allowThemeInput = true,
  title = 'Runtime Stub',
  description = 'Launch the local mock runtime to preview the latest theme output.',
  pollMs = 0,
}: Props) {
  const { status, loading, actionLoading, resetting, startStub, stopStub, resetState, refresh } = useRuntimeStub();
  const [themeInput, setThemeInput] = useState(defaultTheme);
  const runningTheme = status?.theme ?? '';

  useEffect(() => {
    if (defaultTheme) {
      setThemeInput(defaultTheme);
    }
  }, [defaultTheme]);

  useEffect(() => {
    if (!defaultTheme && runningTheme) {
      setThemeInput(runningTheme);
    }
  }, [defaultTheme, runningTheme]);

  const disabled = !themeInput?.trim();
  const canOpen = Boolean(status?.running && status.port);

  const statusText = useMemo(() => {
    if (loading) return 'Checking stub status…';
    if (status?.running) {
      const host = status.port ? `http://localhost:${status.port}/page/index` : 'local port';
      return `Running for ${status.theme || 'unknown'} • ${host}`;
    }
    return 'Stub is offline';
  }, [loading, status]);

  const handleOpen = () => {
    if (!canOpen) return;
    window.open(`http://localhost:${status!.port}/page/index`, '_blank', 'noopener,noreferrer');
  };

  const handleReset = async () => {
    const target = themeInput || status?.theme || '';
    if (!target) return;
    await resetState(target);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <button className="btn-ghost text-xs" onClick={refresh}>
          Refresh
        </button>
      </div>
      <p className="text-sm text-slate-600 flex items-center gap-2">
        <span
          className={`inline-flex h-2.5 w-2.5 rounded-full ${
            status?.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
          }`}
        />
        {statusText}
      </p>
      {allowThemeInput && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="theme"
            value={themeInput}
            onChange={(e) => setThemeInput(e.target.value)}
          />
          <button className="btn-primary text-xs" onClick={() => startStub(themeInput)} disabled={disabled || actionLoading}>
            Start
          </button>
          <button className="btn-secondary text-xs" onClick={() => stopStub()} disabled={actionLoading || !status?.running}>
            Stop
          </button>
          <button className="btn-ghost text-xs" onClick={handleReset} disabled={resetting || (!themeInput && !status?.theme)}>
            Reset State
          </button>
          <button className="btn-ghost text-xs" onClick={handleOpen} disabled={!canOpen}>
            Open Preview
          </button>
        </div>
      )}
    </div>
  );
}

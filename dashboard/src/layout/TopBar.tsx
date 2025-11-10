import { useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { fetchStatus } from '../api';
import { useRuntimeStub } from '../hooks/useRuntimeStub';
import ModeSwitch from '../components/ModeSwitch';

export default function TopBar() {
  const token = useDashboardStore((state) => state.token);
  const setToken = useDashboardStore((state) => state.setToken);
  const status = useDashboardStore((state) => state.status);
  const setStatus = useDashboardStore((state) => state.setStatus);
  const { status: stubStatus, loading: stubLoading } = useRuntimeStub();

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => undefined);
    const interval = setInterval(() => fetchStatus().then(setStatus).catch(() => undefined), 15000);
    return () => clearInterval(interval);
  }, [setStatus]);

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Deemind Factory</p>
        <h1 className="text-xl font-semibold text-slate-900">Intelligent Theming Engine</h1>
        <p className="text-xs text-slate-500">Current Task: {status.current?.label || 'Idle'}</p>
      </div>
      <div className="flex items-center gap-4">
        <ModeSwitch />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              stubStatus?.running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
          <span>
            {stubLoading
              ? 'Checking runtime stub…'
              : stubStatus?.running
                ? `Stub running ${stubStatus.theme ? `• ${stubStatus.theme}` : ''} :${stubStatus.port}`
                : 'Stub stopped'}
          </span>
        </div>
        <input
          type="password"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="Token (optional)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>
    </header>
  );
}

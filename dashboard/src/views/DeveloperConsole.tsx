import { useEffect, useMemo, useState } from 'react';
import { useMode } from '../context/ModeContext';
import { useBuildStream } from '../hooks/useBuildStream';
import { useThemesCatalog } from '../hooks/useThemesCatalog';
import { useDashboardStore } from '../store/useDashboardStore';
import { useScenarioStream } from '../hooks/useScenarioStream';
import { startBuild } from '../api';
import { getExtendedReport, runCommand } from '../lib/api';
import type { RunMode } from '../lib/contracts';
import { getLogLevelLabel, getLogStage, formatServiceLogEntry } from '../lib/serviceLogs';

export default function DeveloperConsole() {
  const { mode } = useMode();
  const { sessions } = useBuildStream();
  const { sessions: scenarioSessions } = useScenarioStream();
  const { themes } = useThemesCatalog();
  const logLines = useDashboardStore((state) => state.logLines);
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!themes.length) return;
    setSelectedTheme((prev) => prev || themes[0]?.name || '');
  }, [themes]);

  const handleLoadReport = async () => {
    if (!selectedTheme) {
      setReport(null);
      return;
    }
    setReportLoading(true);
    setReportError(null);
    try {
      const payload = await getExtendedReport(selectedTheme);
      setReport(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load report.';
      setReportError(message);
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const runAction = async (callback: () => Promise<any>, success: string) => {
    setActionMessage(null);
    setActionError(null);
    try {
      await callback();
      setActionMessage(success);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      setActionError(message);
    } finally {
      setTimeout(() => {
        setActionMessage(null);
        setActionError(null);
      }, 4000);
    }
  };

  const handleStartBuild = async () => {
    if (!selectedTheme) return;
    await runAction(() => startBuild({ theme: selectedTheme, diff: false }), `Build queued for ${selectedTheme}`);
  };

  const handleValidate = async () => {
    if (!selectedTheme) return;
    await runAction(
      () => runCommand('validate', selectedTheme),
      `Validation job queued for ${selectedTheme}`,
    );
  };

  const handleDoctor = async () => {
    await runAction(
      () => runCommand('doctor', ''),
      'Doctor task queued',
    );
  };

  const timelineSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  const filteredLogs = useMemo(() => {
    return logLines
      .filter((entry) => {
        if (levelFilter !== 'all' && entry.level?.toLowerCase() !== levelFilter) return false;
        const stage = getLogStage(entry) || 'general';
        if (stageFilter !== 'all' && stage !== stageFilter) return false;
        return true;
      })
      .slice(-50)
      .reverse();
  }, [logLines, levelFilter, stageFilter]);

  const availableStages = useMemo(() => {
    const set = new Set<string>();
    logLines.forEach((entry) => {
      const stage = getLogStage(entry);
      if (stage) set.add(stage);
    });
    return Array.from(set);
  }, [logLines]);

  if (mode !== 'developer') {
    return (
      <section className="p-6 space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Developer Console</h2>
        <p className="text-sm text-slate-500">Switch to Developer Mode to access debugging tools.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Developer Mode</p>
        <h2 className="text-2xl font-semibold text-slate-900">Developer Console</h2>
        <p className="text-sm text-slate-500">
          Inspect build sessions, reports, and logs without re-running tasks in the browser.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Build Timeline</h3>
            <p className="text-xs text-slate-500">Newest first</p>
          </div>
          <ul className="space-y-3 text-sm">
            {timelineSessions.length === 0 && <li className="text-slate-500">No sessions yet.</li>}
            {timelineSessions.map((session) => (
              <li key={session.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{session.theme}</span>
                  <span>{session.status}</span>
                </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{session.id}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {session.startedAt && session.finishedAt
                    ? `${new Date(session.startedAt).toLocaleTimeString([], { hour12: false })} → ${new Date(
                        session.finishedAt,
                      ).toLocaleTimeString([], { hour12: false })}`
                    : session.startedAt
                      ? `Started ${new Date(session.startedAt).toLocaleTimeString([], { hour12: false })}`
                      : 'Queued'}
                  {session.metrics && (
                    <div className="text-[11px] text-slate-500">
                      {session.metrics.errors} errors · {session.metrics.warnings} warnings
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Latest Scenarios</h3>
              <p className="text-xs text-slate-500">Runtime smoke & scenario runs</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {scenarioSessions.slice(0, 5).map((session) => (
              <li key={session.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{session.theme}</span>
                  <span>{session.status}</span>
                </div>
                <p className="text-sm text-slate-900">{session.chain?.join(' → ') || 'Scenario'}</p>
              </li>
            ))}
            {scenarioSessions.length === 0 && <li className="text-slate-500 text-sm">No runtime scenarios yet.</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
          >
            <option value="">Select theme</option>
            {themes.map((theme) => (
              <option key={theme.name} value={theme.name}>
                {theme.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoadReport}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white disabled:opacity-40"
            disabled={!selectedTheme || reportLoading}
          >
            {reportLoading ? 'Loading…' : 'Load Report JSON'}
          </button>
          <button
            type="button"
            onClick={handleStartBuild}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white disabled:opacity-40"
            disabled={!selectedTheme}
          >
            Build
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white disabled:opacity-40"
            disabled={!selectedTheme}
          >
            Validate
          </button>
          <button
            type="button"
            onClick={handleDoctor}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white"
          >
            Run Doctor
          </button>
        </div>
        {actionMessage && <p className="text-xs text-emerald-600">{actionMessage}</p>}
        {actionError && <p className="text-xs text-rose-600">{actionError}</p>}
        {reportError && <p className="text-xs text-rose-600">{reportError}</p>}
        {report ? (
          <pre className="max-h-[24rem] overflow-auto rounded-xl bg-slate-950/90 p-4 text-xs text-slate-100">
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">Select a theme and load its extended report.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">All levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <select
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {availableStages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
        <div className="max-h-[18rem] overflow-auto rounded-xl border border-slate-100 bg-slate-950/95 p-3 text-xs text-slate-100">
          {filteredLogs.length === 0 && <p className="text-slate-500">No log entries.</p>}
          {filteredLogs.map((entry, idx) => (
            <div key={`${entry.ts}-${idx}`} className="mb-2 rounded-md bg-black/30 p-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{new Date(entry.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span>{getLogLevelLabel(entry.level)}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-100">
                {formatServiceLogEntry(entry)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

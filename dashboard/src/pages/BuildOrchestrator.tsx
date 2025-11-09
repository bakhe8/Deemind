import { useEffect, useMemo, useState } from 'react';
import { fetchThemes, type ThemeSummary } from '../api/themes';
import { startBuild, type BuildSession } from '../api/build';
import { triggerRunJob } from '../api/system';
import { useBuildStream } from '../hooks/useBuildStream';
import { useJobHistory } from '../hooks/useJobHistory';
import { useRunnerStatus } from '../hooks/useRunnerStatus';
import type { JobStatus, RunMode } from '../lib/contracts';
import { usePreviewMatrix } from '../hooks/usePreviewMatrix';

function formatTimestamp(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function statusBadge(status: BuildSession['status']) {
  switch (status) {
    case 'running':
      return 'bg-amber-100 text-amber-700';
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function jobStatusBadge(status: JobStatus['status']) {
  switch (status) {
    case 'running':
      return 'bg-violet-100 text-violet-700';
    case 'ok':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function BuildOrchestrator() {
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('demo');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [launching, setLaunching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [runMode, setRunMode] = useState<RunMode>('build');
  const [inputFolder, setInputFolder] = useState('');
  const [jobLoading, setJobLoading] = useState(false);
  const { sessions, getLogs } = useBuildStream();
  const { jobs, loading: jobsLoading, error: jobsError, refresh: refreshJobs } = useJobHistory({ pollMs: 7000 });
  const { status: runnerStatus, loading: runnerLoading, error: runnerError, refresh: refreshRunner } = useRunnerStatus(6000);
  const {
    map: previewMap,
    loading: previewMatrixLoading,
    refresh: refreshPreviewMatrix,
  } = usePreviewMatrix({ pollMs: 25000 });
  const themeOptions = useMemo(() => {
    const set = new Set<string>();
    themes.forEach((theme) => set.add(theme.name));
    sessions.forEach((session) => set.add(session.theme));
    return Array.from(set);
  }, [sessions, themes]);

  useEffect(() => {
    fetchThemes().then((res) => setThemes(res.themes || [])).catch(() => undefined);
  }, []);

  const filteredSessions = useMemo(() => {
    if (sessionFilter === 'all') return sessions;
    return sessions.filter((session) => session.theme === sessionFilter);
  }, [sessions, sessionFilter]);

  useEffect(() => {
    if (!filteredSessions.length) {
      setSelectedSessionId(null);
      return;
    }
    if (!selectedSessionId || !filteredSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(filteredSessions[0].id);
    }
  }, [filteredSessions, selectedSessionId]);

  const activeSession = useMemo(() => {
    if (!selectedSessionId) return filteredSessions[0] || null;
    return filteredSessions.find((session) => session.id === selectedSessionId) || filteredSessions[0] || null;
  }, [filteredSessions, selectedSessionId]);

  const handleStartBuild = async (withDiff: boolean) => {
    if (!selectedTheme) return;
    setLaunching(true);
    setMessage(null);
    try {
      const response = await startBuild({ theme: selectedTheme, diff: withDiff });
      setMessage(`Build queued for ${selectedTheme} (session ${response.session.id}).`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to start build.';
      setMessage(reason);
    } finally {
      setLaunching(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleRunJob = async () => {
    setJobMessage(null);
    setJobError(null);
    setJobLoading(true);
    try {
      const payload = {
        mode: runMode,
        inputFolder: inputFolder.trim() || undefined,
      } as { mode: RunMode; inputFolder?: string };
      const response = await triggerRunJob(payload);
      setJobMessage(`Job ${response.id} queued (${response.status}).`);
      refreshJobs();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to trigger job.';
      setJobError(reason);
    } finally {
      setJobLoading(false);
      setTimeout(() => setJobMessage(null), 4000);
    }
  };

  const logs = activeSession ? getLogs(activeSession.id) : [];
  const selectedSnapshot = selectedTheme ? previewMap[selectedTheme] : undefined;
  const snapshotClass =
    selectedSnapshot && selectedSnapshot.pages.length && selectedSnapshot.status === 'ready'
      ? 'text-emerald-600'
      : selectedSnapshot
        ? 'text-amber-600'
        : 'text-slate-600';
  const snapshotSummary = previewMatrixLoading
    ? 'Checking snapshot coverage…'
    : selectedSnapshot
      ? selectedSnapshot.pages.length
        ? `${selectedSnapshot.pages.length} page${selectedSnapshot.pages.length === 1 ? '' : 's'} • ${selectedSnapshot.status}`
        : `No pages captured yet • ${selectedSnapshot.status}`
      : 'Snapshots unavailable for this theme.';

  return (
    <>
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛠️</span>
            <div>
              <h1 className="text-lg font-semibold">Build Orchestrator</h1>
              <p className="text-xs text-slate-500">Trigger CLI builds and monitor their progress without leaving the dashboard.</p>
            </div>
          </div>
          <div className="flex-1" />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
          >
            {themes.map((theme) => (
              <option key={theme.name} value={theme.name}>
                {theme.name}
              </option>
            ))}
          </select>
          <button className="btn-primary text-sm" disabled={launching || !selectedTheme} onClick={() => handleStartBuild(false)}>
            {launching ? 'Queuing…' : 'Run Build'}
          </button>
          <button className="btn-secondary text-sm" disabled={launching || !selectedTheme} onClick={() => handleStartBuild(true)}>
            {launching ? 'Queuing…' : 'Run Build + Diff'}
          </button>
        </div>
        {message && <p className="text-xs text-emerald-600">{message}</p>}
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Snapshot coverage</p>
            <p className={`text-sm font-semibold ${snapshotClass}`}>{snapshotSummary}</p>
            {selectedSnapshot?.timestamp && (
              <p className="text-[11px] text-slate-500">
                Last refresh {new Date(selectedSnapshot.timestamp).toLocaleString()}
              </p>
            )}
          </div>
          <button
            className="btn-ghost text-xs"
            onClick={refreshPreviewMatrix}
            disabled={previewMatrixLoading}
          >
            {previewMatrixLoading ? 'Refreshing…' : 'Refresh coverage'}
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Runner Status</h2>
              <p className="text-xs text-slate-500">Current CLI task coming from the central queue.</p>
            </div>
            <button className="btn-ghost text-xs" onClick={refreshRunner} disabled={runnerLoading}>
              Refresh
            </button>
          </div>
          {runnerError ? (
            <p className="text-xs text-rose-600">{runnerError}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700">
                {runnerStatus.current?.label || 'Idle'}
                {runnerStatus.current?.id ? ` (#${runnerStatus.current.id})` : ''}
              </p>
              <p className="text-xs text-slate-500">
                {runnerStatus.current ? 'Running now' : 'No tasks running right now.'} · Queue:{' '}
                {runnerStatus.queue.length}
              </p>
              {runnerStatus.queue.length ? (
                <ul className="text-xs text-slate-600 border border-slate-100 rounded-xl divide-y divide-slate-100">
                  {runnerStatus.queue.slice(0, 4).map((item, idx) => (
                    <li key={`${item.id || item.label}-${idx}`} className="px-3 py-2">
                      {item.label || item.id || 'task'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Queue is clear.</p>
              )}
            </>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Session Filter</h2>
          <p className="text-xs text-slate-500">Focus the session list on a specific theme.</p>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option value="all">All themes</option>
            {themeOptions.map((themeName) => (
              <option key={themeName} value={themeName}>
                {themeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">Recent Sessions</p>
            <span className="text-xs text-slate-400">{sessions.length} total</span>
          </div>
          {!filteredSessions.length ? (
            <p className="text-xs text-slate-500">No builds have been queued yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {filteredSessions.map((session) => (
                <li
                  key={session.id}
                  className={`p-3 cursor-pointer text-sm ${
                    activeSession?.id === session.id ? 'bg-slate-50' : 'bg-white'
                  }`}
                  onClick={() => setSelectedSessionId(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-700">{session.theme}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(session.status)}`}>
                      {session.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Started: {formatTimestamp(session.startedAt)}
                    <br />
                    Finished: {formatTimestamp(session.finishedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          {activeSession ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {activeSession.theme} • {activeSession.diff ? 'Build + Diff' : 'Standard Build'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Status: <strong>{activeSession.status}</strong> • Source: {activeSession.source}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Session #{activeSession.id}</span>
                    {typeof activeSession.exitCode === 'number' && (
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          activeSession.exitCode === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        Exit {activeSession.exitCode}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  <p>Started: {formatTimestamp(activeSession.startedAt)}</p>
                  <p>Finished: {formatTimestamp(activeSession.finishedAt)}</p>
                </div>
              </div>
              {activeSession.metrics ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Errors</p>
                    <p className="text-2xl font-semibold text-slate-800">{activeSession.metrics.errors}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Warnings</p>
                    <p className="text-2xl font-semibold text-slate-800">{activeSession.metrics.warnings}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {activeSession.status === 'succeeded'
                    ? 'Metrics not available for this session.'
                    : 'Metrics will appear after the build completes.'}
                </p>
              )}
              <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-xs h-64 overflow-y-auto shadow-inner">
                {!logs.length ? <p>No logs captured yet.</p> : logs.map((line, idx) => <div key={`${activeSession.id}-log-${idx}`}>{line}</div>)}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a session to inspect logs.</p>
          )}
        </div>
      </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">CLI Task Runner</h2>
            <p className="text-xs text-slate-500">Trigger shared CLI jobs (build / validate / doctor) without leaving the dashboard.</p>
          </div>
          <div className="flex-1" />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as RunMode)}
          >
            <option value="build">Build (full factory)</option>
            <option value="validate">Validate</option>
            <option value="doctor">Doctor</option>
          </select>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="input folder (optional)"
            value={inputFolder}
            onChange={(e) => setInputFolder(e.target.value)}
          />
          <button className="btn-secondary text-sm" disabled={jobLoading} onClick={handleRunJob}>
            {jobLoading ? 'Queuing…' : 'Run Task'}
          </button>
        </div>
        {jobMessage && <p className="text-xs text-emerald-600">{jobMessage}</p>}
        {jobError && <p className="text-xs text-rose-600">{jobError}</p>}
        {jobsError && <p className="text-xs text-rose-600">{jobsError}</p>}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-600">Recent Jobs</p>
            <button className="btn-ghost text-xs" onClick={refreshJobs} disabled={jobsLoading}>
              Refresh
            </button>
          </div>
          {jobsLoading && !jobs.length ? (
            <p className="text-xs text-slate-500">Loading job history…</p>
          ) : !jobs.length ? (
            <p className="text-xs text-slate-500">No jobs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {jobs.map((job) => (
                <li key={job.id} className="p-3 text-sm bg-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-700">{job.message || job.id}</p>
                      <p className="text-xs text-slate-500">
                        Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                        <br />
                        Finished: {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : '—'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${jobStatusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

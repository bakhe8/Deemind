import { useEffect, useMemo, useState } from 'react';
import { useScenarioStream, type ScenarioSession } from '../hooks/useScenarioStream';
import { fetchScenarioDetail } from '../api/system';

type ScenarioDetail = {
  id: string;
  session: ScenarioSession | null;
  log: {
    chain?: string[];
    startedAt?: string;
    finishedAt?: string;
    succeeded?: boolean;
    scenarios?: Array<{ name: string; startedAt?: string; finishedAt?: string; succeeded?: boolean; error?: string }>;
    steps?: Array<{
      method?: string;
      path?: string;
      status?: number;
      scenario?: string;
      startedAt?: string;
      finishedAt?: string;
      error?: string;
    }>;
  };
};

type Props = {
  refreshKey?: number;
};

function statusBadge(status: ScenarioSession['status']) {
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

export default function ScenarioRunsPanel({ refreshKey }: Props) {
  const { sessions } = useScenarioStream();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessions.length) return;
    if (!selectedId) {
      setSelectedId(sessions[0].id);
    } else if (!sessions.find((session) => session.id === selectedId)) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchScenarioDetail(selectedId)
      .then((res) => {
        setDetail(res);
      })
      .catch((err) => {
        const reason = err instanceof Error ? err.message : 'Failed to load scenario detail.';
        setError(reason);
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (typeof refreshKey === 'number') {
      setDetail(null);
      setSelectedId(null);
    }
  }, [refreshKey]);

  const activeSession = useMemo(() => sessions.find((session) => session.id === selectedId) || null, [sessions, selectedId]);
  const scenarioSegments = detail?.log?.scenarios || [];
  const steps = detail?.log?.steps || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scenario Sessions</h2>
          <p className="text-xs text-slate-500">Replay each runtime flow and inspect every HTTP step.</p>
        </div>
        <span className="text-xs text-slate-400">{sessions.length} recorded</span>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {!sessions.length ? (
            <p className="text-xs text-slate-500 p-3">No scenarios have been executed yet.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={`w-full text-left p-3 text-sm ${
                  session.id === selectedId ? 'bg-slate-50' : 'bg-white'
                }`}
                onClick={() => setSelectedId(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-700">{session.theme}</p>
                    <p className="text-xs text-slate-500">{session.chain.join(' → ')}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(session.status)}`}>
                    {session.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Started: {session.startedAt ? new Date(session.startedAt).toLocaleTimeString() : '—'}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading scenario detail…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : detail && activeSession ? (
            <>
              <div className="border border-slate-100 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {activeSession.theme} • {activeSession.chain.join(' → ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Started {detail.log?.startedAt ? new Date(detail.log.startedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(activeSession.status)}`}>
                    {activeSession.status}
                  </span>
                </div>
              </div>
              <div className="border border-slate-100 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-slate-700">Scenario Timeline</p>
                {scenarioSegments.length ? (
                  <ul className="text-sm text-slate-600 space-y-2">
                    {scenarioSegments.map((segment, index) => (
                      <li key={`${selectedId}-segment-${index}`} className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-slate-500">{segment.name}</span>
                        <span className={segment.succeeded ? 'text-emerald-600 text-xs' : 'text-rose-600 text-xs'}>
                          {segment.succeeded ? 'Succeeded' : 'Failed'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {segment.startedAt ? new Date(segment.startedAt).toLocaleTimeString() : '—'} →
                          {segment.finishedAt ? new Date(segment.finishedAt).toLocaleTimeString() : '—'}
                        </span>
                        {segment.error && <span className="text-xs text-rose-600">{segment.error}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">Scenario has not recorded segments yet.</p>
                )}
              </div>
              <div className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">HTTP Steps</p>
                {steps.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="py-1 pr-3 text-left">Scenario</th>
                          <th className="py-1 pr-3 text-left">Method</th>
                          <th className="py-1 pr-3 text-left">Path</th>
                          <th className="py-1 pr-3 text-left">Status</th>
                          <th className="py-1 pr-3 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps.map((step, idx) => (
                          <tr key={`${selectedId}-step-${idx}`} className="border-t border-slate-100">
                            <td className="py-1 pr-3">{step.scenario || '—'}</td>
                            <td className="py-1 pr-3 font-semibold">{step.method}</td>
                            <td className="py-1 pr-3 font-mono">{step.path}</td>
                            <td className="py-1 pr-3">{step.status ?? '—'}</td>
                            <td className="py-1 pr-3">
                              {step.startedAt ? new Date(step.startedAt).toLocaleTimeString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No steps recorded yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a scenario session to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

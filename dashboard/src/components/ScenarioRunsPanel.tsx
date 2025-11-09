import { useEffect, useState } from 'react';
import { fetchScenarioRuns } from '../api/system';

type ScenarioRun = {
  file: string;
  theme: string;
  chain?: string[];
  scenarios?: Array<{ name: string; startedAt: string; finishedAt: string; succeeded: boolean; error?: string | null }>;
  steps: number;
  startedAt: string;
  finishedAt?: string;
  succeeded: boolean;
  error?: string | null;
};

export default function ScenarioRunsPanel() {
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchScenarioRuns(8);
      setRuns(data.runs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scenario Runs</h2>
          <p className="text-xs text-slate-500">Latest automated flows captured from `npm run runtime:scenario`.</p>
        </div>
        <button className="btn-ghost text-xs" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {!runs.length ? (
        <p className="text-sm text-slate-500">{loading ? 'Loading…' : 'No scenario logs yet.'}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {runs.map((run) => (
            <li key={run.file} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(run.startedAt).toLocaleString()}</span>
                <span className={run.succeeded ? 'text-emerald-600' : 'text-rose-600'}>
                  {run.succeeded ? 'Succeeded' : 'Failed'}
                </span>
              </div>
              <p className="text-slate-700">
                Theme <strong>{run.theme}</strong> · Chain:{' '}
                {(run.chain || []).length ? run.chain!.join(' → ') : 'n/a'}
              </p>
              <p className="text-xs text-slate-500">Steps captured: {run.steps}</p>
              {run.error && <p className="text-xs text-rose-600">Error: {run.error}</p>}
              {run.scenarios?.length ? (
                <div className="mt-2 text-xs text-slate-500">
                  {run.scenarios.map((segment) => (
                    <div key={`${run.file}-${segment.name}`} className="flex items-center justify-between">
                      <span>{segment.name}</span>
                      <span className={segment.succeeded ? 'text-emerald-500' : 'text-rose-500'}>
                        {segment.succeeded ? 'ok' : 'failed'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


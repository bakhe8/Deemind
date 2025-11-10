import { useEffect, useState } from 'react';
import { fetchScenarioFlows, runRuntimeScenario } from '../api';

type Props = {
  theme?: string;
  onQueued?: () => void;
};

export default function ScenarioRunnerControls({ theme, onQueued }: Props) {
  const [selected, setSelected] = useState<string[]>(['checkout']);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [flows, setFlows] = useState<Array<{ id: string; label: string }>>([]);
  const [flowsLoading, setFlowsLoading] = useState(true);

  useEffect(() => {
    fetchScenarioFlows()
      .then((res) => {
        const list = res.flows && res.flows.length ? res.flows : [
          { id: 'checkout', label: 'Checkout Flow' },
          { id: 'add-to-cart', label: 'Add to Cart' },
          { id: 'wishlist', label: 'Wishlist Loop' },
        ];
        setFlows(list);
        if (!selected.length && list.length) {
          setSelected([list[0].id]);
        }
      })
      .catch(() => {
        setFlows([
          { id: 'checkout', label: 'Checkout Flow' },
          { id: 'add-to-cart', label: 'Add to Cart' },
          { id: 'wishlist', label: 'Wishlist Loop' },
        ]);
      })
      .finally(() => setFlowsLoading(false));
  }, []);

  const toggleScenario = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleRun = async () => {
    if (!theme) {
      setMessage('Select a theme first to run scenarios.');
      return;
    }
    if (!selected.length) {
      setMessage('Choose at least one scenario.');
      return;
    }
    setRunning(true);
    setMessage(null);
    try {
      await runRuntimeScenario({ theme, chain: selected });
      setMessage('Scenario chain queued. Check Scenario Runs for results.');
      onQueued?.();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Failed to queue scenario.';
      setMessage(reason);
    } finally {
      setRunning(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Scenario Runner</h2>
          <p className="text-xs text-slate-500">
            {theme ? `Theme: ${theme}` : 'Select a theme to enable scenario playback.'}
          </p>
        </div>
        <button className="btn-primary text-xs" onClick={handleRun} disabled={running || !theme}>
          {running ? 'Queuing…' : 'Run Selected'}
        </button>
      </div>
      {flowsLoading ? (
        <p className="text-xs text-slate-500">Loading scenarios…</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          {flows.map((scenario) => {
            const active = selected.includes(scenario.id);
            return (
              <label
                key={scenario.id}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer ${
                  active ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-emerald-500"
                  checked={active}
                  onChange={() => toggleScenario(scenario.id)}
                />
                <span>{scenario.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {message && <p className="text-xs text-slate-600">{message}</p>}
    </div>
  );
}

import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { usePreviewMatrix } from '../hooks/usePreviewMatrix';

const links = [
  { to: '/build', label: 'Build Orchestrator', emoji: '🛠️' },
  { to: '/runtime', label: 'Runtime Inspector', emoji: '🛰️' },
  { to: '/preview', label: 'Preview Manager', emoji: '🖼️' },
  { to: '/upload', label: 'Theme Intake', emoji: '🗂️' },
  { to: '/parser', label: 'Parser & Mapper', emoji: '🧠' },
  { to: '/adapter', label: 'Adapter & Baseline', emoji: '🧱' },
  { to: '/validation', label: 'Validation & QA', emoji: '🩺' },
  { to: '/reports', label: 'Reports & Metrics', emoji: '📊' },
  { to: '/settings', label: 'Settings', emoji: '⚙️' },
];

export default function SidebarNav() {
  const { entries, loading } = usePreviewMatrix({ pollMs: 45000 });
  const coverage = useMemo(() => {
    if (!entries.length) {
      return { total: 0, ready: 0, missing: 0 };
    }
    let ready = 0;
    let missing = 0;
    entries.forEach((entry) => {
      const hasPages = Array.isArray(entry.pages) && entry.pages.length > 0;
      if (hasPages && entry.status === 'ready' && !entry.missing) {
        ready += 1;
      } else {
        missing += 1;
      }
    });
    return { total: entries.length, ready, missing };
  }, [entries]);

  return (
    <aside className="w-68 bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-800">
        <p className="text-xs uppercase tracking-[0.5em] text-slate-400">Deemind</p>
        <p className="text-2xl font-semibold">Factory</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition',
                isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-300 hover:bg-white/5',
              )
            }
          >
            <span>{link.emoji}</span>
            <span className="flex-1">{link.label}</span>
            {link.to === '/preview' && coverage.total > 0 && (
              <span
                className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full border',
                  loading
                    ? 'border-amber-400/30 text-amber-100 bg-amber-500/20'
                    : coverage.missing
                        ? 'border-rose-400/30 text-rose-100 bg-rose-500/20'
                        : 'border-emerald-400/30 text-emerald-100 bg-emerald-500/20',
                )}
              >
                {loading
                  ? 'Syncing…'
                  : coverage.missing
                      ? `${coverage.missing} missing`
                      : 'All ready'}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-800 space-y-1">
        <p>Dashboard v1.0</p>
        {coverage.total ? (
          <p className="text-[11px] text-slate-400">
            Snapshot coverage:{' '}
            <span className={coverage.missing ? 'text-rose-200' : 'text-emerald-200'}>
              {coverage.ready}/{coverage.total} ready
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">{loading ? 'Syncing snapshot matrix…' : 'No snapshots tracked yet.'}</p>
        )}
      </div>
    </aside>
  );
}

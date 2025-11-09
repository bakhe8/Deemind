import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const links = [
  { to: '/upload', label: 'Theme Intake', emoji: '🗂️' },
  { to: '/parser', label: 'Parser & Mapper', emoji: '🧠' },
  { to: '/adapter', label: 'Adapter & Baseline', emoji: '🧱' },
  { to: '/validation', label: 'Validation & QA', emoji: '🩺' },
  { to: '/reports', label: 'Reports & Metrics', emoji: '📊' },
  { to: '/settings', label: 'Settings', emoji: '⚙️' },
];

export default function SidebarNav() {
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
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-800">
        Dashboard v1.0
      </div>
    </aside>
  );
}

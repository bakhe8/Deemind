import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useMode } from '../context/ModeContext';
import { ENABLE_BRANDS } from '../utils/constants';

type NavItem = {
  to: string;
  label: string;
  emoji: string;
  requiresBrands?: boolean;
};

const baseLinks: NavItem[] = [
  { to: '/brands', label: 'Brands & Identity', emoji: '🧠', requiresBrands: true },
  { to: '/creative/brand-wizard', label: 'Brand Wizard', emoji: '🎨', requiresBrands: true },
  { to: '/build', label: 'Build & Validation', emoji: '⚙️' },
  { to: '/reports', label: 'Reports & Logs', emoji: '📊' },
  { to: '/preview', label: 'Preview & Delivery', emoji: '🚀' },
];

export default function SidebarNav() {
  const { mode } = useMode();
  const visibleBase = baseLinks.filter((link) => !link.requiresBrands || ENABLE_BRANDS);
  const links =
    mode === 'developer'
      ? [...visibleBase, { to: '/dev/console', label: 'Developer Console', emoji: '🛠️' }]
      : visibleBase;
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
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 text-xs text-slate-500 border-t border-slate-800 space-y-1">
        <p>Dashboard v2 · Control Tower</p>
        <p className="text-[11px] text-slate-400">Read-only UI — all actions run via service APIs.</p>
      </div>
    </aside>
  );
}

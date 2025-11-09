import { useMode } from '../context/ModeContext';

export default function ModeSwitch() {
  const { mode, toggleMode } = useMode();
  const isDev = mode === 'developer';

  return (
    <button
      type="button"
      onClick={toggleMode}
      className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
      title={isDev ? 'Switch to friendly mode' : 'Switch to developer mode'}
    >
      <span role="img" aria-label={isDev ? 'Developer mode' : 'Friendly mode'}>
        {isDev ? '🧠' : '😊'}
      </span>
      {isDev ? 'Dev Mode' : 'Friendly Mode'}
    </button>
  );
}


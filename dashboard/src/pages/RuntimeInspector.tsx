import { useEffect, useMemo, useState } from 'react';
import {
  fetchRuntimeState,
  fetchRuntimeContext,
  regenerateRuntimeContext,
  updateRuntimeLocale,
  clearRuntimeCart,
  removeRuntimeCartItem,
  clearRuntimeWishlist,
  removeRuntimeWishlistItem,
  logoutRuntimeUser,
} from '../api';
import { useRuntimeStub } from '../hooks/useRuntimeStub';
import RuntimeEventFeed from '../components/RuntimeEventFeed';
import RuntimeAnalyticsTable from '../components/RuntimeAnalyticsTable';

type RuntimeState = {
  store?: { name?: string; language?: string; currency?: string };
  cart?: { items?: Array<{ id: number; name?: string; quantity?: number; price?: number }>; total?: number };
  wishlist?: { items?: Array<{ id: number; name?: string; price?: number }> };
  session?: { user?: { name?: string; email?: string } | null };
  preset?: { name?: string; demo?: string; partials?: string[] };
  navigation?: Array<{ label?: string; href?: string }>;
  hero?: { title?: string; eyebrow?: string; subtitle?: string };
  categories?: Array<{ name?: string; slug?: string }>;
  user?: { name?: string; email?: string } | null;
  locales?: Record<string, any>;
};
type ContextInfo = { source: string; context: any | null };

export default function RuntimeInspector() {
  const { stubs, resetState, refresh: refreshStubs } = useRuntimeStub();
  const [theme, setTheme] = useState('');
  const [state, setState] = useState<RuntimeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [localeInput, setLocaleInput] = useState('en');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextDemo, setContextDemo] = useState('electronics');
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    if (!stubs.length) return;
    if (!theme) {
      setTheme(stubs[0].theme);
      return;
    }
    const exists = stubs.some((stub) => stub.theme === theme);
    if (!exists) {
      setTheme(stubs[0].theme);
    }
  }, [stubs, theme]);

  useEffect(() => {
    if (!theme) return;
    loadState(theme);
  }, [theme]);

  const loadContext = async (targetTheme: string) => {
    setContextLoading(true);
    setContextError(null);
    try {
      const response = await fetchRuntimeContext(targetTheme);
      setContextInfo({ source: response.source, context: response.context });
      const nextDemo =
        response.context?.meta?.demo ||
        response.context?.preset?.demo ||
        targetTheme ||
        'electronics';
      setContextDemo(nextDemo);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to load mock context.';
      setContextInfo(null);
      setContextError(reason);
    } finally {
      setContextLoading(false);
    }
  };

  const loadState = async (targetTheme: string, options?: { loadContext?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchRuntimeState(targetTheme);
      setState(response.state || null);
      setLocaleInput(response.state?.store?.language || 'en');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to fetch runtime state.';
      setError(reason);
      setState(null);
    } finally {
      setLoading(false);
    }
    if (options?.loadContext !== false) {
      loadContext(targetTheme);
    }
  };

  const handleLocaleSave = async () => {
    if (!theme || !localeInput.trim()) return;
    setMessage(null);
    setError(null);
    try {
      const response = await updateRuntimeLocale({ theme, language: localeInput.trim() });
      setState(response.state || null);
      setMessage(`Locale updated to ${localeInput.trim()}.`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Failed to update locale.';
      setError(reason);
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleReset = async () => {
    if (!theme) return;
    await resetState(theme);
    await loadState(theme);
  };

  const handleContextRefresh = async () => {
    if (!theme) return;
    setContextError(null);
    setContextLoading(true);
    try {
      const response = await regenerateRuntimeContext({
        theme,
        demo: contextDemo.trim() || undefined,
      });
      setContextInfo({ source: 'cache', context: response.context });
      setMessage(`Mock context regenerated using demo "${response.demo}".`);
      await loadState(theme, { loadContext: false });
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Failed to regenerate mock context.';
      setContextError(reason);
    } finally {
      setContextLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleCartClear = async () => {
    if (!theme) return;
    setError(null);
    try {
      const response = await clearRuntimeCart(theme);
      setState(response.state || null);
      setMessage('Cart cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart.');
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleCartRemove = async (id: number) => {
    if (!theme) return;
    setError(null);
    try {
      const response = await removeRuntimeCartItem({ theme, id });
      setState(response.state || null);
      setMessage('Item removed from cart.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item.');
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleWishlistClear = async () => {
    if (!theme) return;
    setError(null);
    try {
      const response = await clearRuntimeWishlist(theme);
      setState(response.state || null);
      setMessage('Wishlist cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear wishlist.');
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleWishlistRemove = async (id: number) => {
    if (!theme) return;
    setError(null);
    try {
      const response = await removeRuntimeWishlistItem({ theme, id });
      setState(response.state || null);
      setMessage('Item removed from wishlist.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove wishlist item.');
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleLogout = async () => {
    if (!theme) return;
    setError(null);
    try {
      const response = await logoutRuntimeUser(theme);
      setState(response.state || null);
      setMessage('User logged out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log out user.');
    } finally {
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const cartItems = state?.cart?.items || [];
  const wishlistItems = state?.wishlist?.items || [];
  const presetPartials = state?.preset?.partials || [];
  const activeStub = stubs.find((stub) => stub.theme === theme) || null;
  const stubOptions = useMemo(() => stubs.map((stub) => stub.theme), [stubs]);
  const handleOpenPreview = () => {
    if (!activeStub?.port) return;
    window.open(`http://localhost:${activeStub.port}/page/index`, '_blank', 'noopener,noreferrer');
  };
  const handleStubRefresh = () => {
    refreshStubs();
  };
  const contextSummary = useMemo(() => {
    if (!contextInfo?.context) return null;
    const ctx = contextInfo.context;
    return {
      demo: ctx.meta?.demo || state?.preset?.demo || theme || '—',
      products: Array.isArray(ctx.products) ? ctx.products.length : 0,
      categories: Array.isArray(ctx.categories) ? ctx.categories.length : 0,
      navigation: Array.isArray(ctx.navigation) ? ctx.navigation.length : 0,
      heroTitle: ctx.hero?.title || ctx.hero?.eyebrow || '',
      generatedAt: ctx.meta?.generatedAt,
    };
  }, [contextInfo, state, theme]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold">Runtime Inspector</h1>
            <p className="text-xs text-slate-500">
              Inspect store state, cart, session, and locale for any theme — even if the stub is offline.
            </p>
          </div>
          <div className="flex-1" />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="">Choose theme…</option>
            {stubOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="custom theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
          <button className="btn-secondary text-sm" onClick={() => theme && loadState(theme)} disabled={!theme || loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn-ghost text-sm" onClick={handleStubRefresh}>
            Refresh Stubs
          </button>
          <button className="btn-ghost text-sm" onClick={handleOpenPreview} disabled={!activeStub?.port}>
            Open Preview
          </button>
          <button className="btn-ghost text-sm" onClick={handleReset} disabled={!theme}>
            Reset Runtime
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {theme
            ? activeStub?.port
              ? `Stub ${theme} is running on port ${activeStub.port}.`
              : 'Theme selected without an active stub. You can inspect cached state, but live SSE data will be paused.'
            : 'Select a theme to load its runtime state.'}
        </p>
        {message && <p className="text-xs text-emerald-600">{message}</p>}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      {state ? (
        <div className="grid lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Store</p>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>
                <strong>Name:</strong> {state.store?.name || '—'}
              </li>
              <li>
                <strong>Language:</strong> {state.store?.language || '—'}
              </li>
              <li>
                <strong>Currency:</strong> {state.store?.currency || '—'}
              </li>
            </ul>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 mb-1">Update Locale</p>
              <div className="flex gap-2">
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
                  value={localeInput}
                  onChange={(e) => setLocaleInput(e.target.value)}
                  placeholder="en / ar"
                />
                <button className="btn-primary text-xs" onClick={handleLocaleSave} disabled={!localeInput.trim()}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Session</p>
            {state.session?.user ? (
              <ul className="text-sm text-slate-600 space-y-1">
                <li>
                  <strong>Name:</strong> {state.session.user.name || '—'}
                </li>
                <li>
                  <strong>Email:</strong> {state.session.user.email || '—'}
                </li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No user logged in.</p>
            )}
            {state.session?.user ? (
              <button className="btn-secondary text-xs" onClick={handleLogout}>
                Log Out User
              </button>
            ) : null}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 mb-1">Preset</p>
              <p className="text-xs text-slate-600">
                {state.preset?.name || state.preset?.demo || '—'}
              </p>
              {presetPartials.length ? (
                <p className="text-[11px] text-slate-500 mt-1">
                  Partials: {presetPartials.slice(0, 6).join(', ')}
                  {presetPartials.length > 6 ? '…' : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Cart Summary</p>
            <p className="text-2xl font-semibold text-slate-800">{state.cart?.total?.toFixed?.(2) ?? state.cart?.total ?? 0} {state.store?.currency || '—'}</p>
            <p className="text-xs text-slate-500">{cartItems.length} items</p>
            <button className="btn-secondary text-xs" onClick={handleCartClear} disabled={!cartItems.length}>
              Clear Cart
            </button>
            {cartItems.length ? (
              <ul className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
                {cartItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>
                      {item.name || `#${item.id}`} × {item.quantity ?? 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{item.price ?? '—'}</span>
                      <button className="btn-ghost text-[10px]" onClick={() => handleCartRemove(Number(item.id))}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Cart is empty.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-600">Mock Context</p>
              <span className="text-[11px] text-slate-500">
                {contextLoading ? 'Loading…' : contextInfo?.source ? contextInfo.source : '—'}
              </span>
            </div>
            {contextSummary ? (
              <ul className="text-sm text-slate-600 space-y-1">
                <li>
                  <strong>Demo:</strong> {contextSummary.demo}
                </li>
                <li>
                  <strong>Products:</strong> {contextSummary.products}
                </li>
                <li>
                  <strong>Categories:</strong> {contextSummary.categories}
                </li>
                <li>
                  <strong>Navigation links:</strong> {contextSummary.navigation}
                </li>
                <li>
                  <strong>Hero:</strong> {contextSummary.heroTitle || '—'}
                </li>
                <li className="text-xs text-slate-500">
                  Generated {contextSummary.generatedAt ? new Date(contextSummary.generatedAt).toLocaleString() : '—'}
                </li>
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                {contextLoading ? 'Loading context…' : 'No context snapshot available.'}
              </p>
            )}
            {contextError && <p className="text-xs text-rose-600">{contextError}</p>}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 mb-1">Regenerate Cache (demo)</p>
              <div className="flex gap-2">
                <input
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
                  value={contextDemo}
                  onChange={(e) => setContextDemo(e.target.value)}
                  disabled={contextLoading}
                  placeholder="electronics"
                />
                <button
                  className="btn-primary text-xs"
                  onClick={handleContextRefresh}
                  disabled={!theme || contextLoading || !contextDemo.trim()}
                >
                  {contextLoading ? 'Working…' : 'Regenerate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-sm text-slate-500">
            {theme ? 'No runtime state available for this theme yet.' : 'Select a theme to inspect its runtime state.'}
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <RuntimeEventFeed title="Live Runtime Events" limit={10} theme={theme || undefined} />
        <RuntimeAnalyticsTable theme={theme || undefined} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Wishlist Items</h2>
        <button className="btn-secondary text-xs" onClick={handleWishlistClear} disabled={!wishlistItems.length}>
          Clear Wishlist
        </button>
        {wishlistItems.length ? (
          <ul className="text-sm text-slate-600 space-y-1">
            {wishlistItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>
                  {item.name || `#${item.id}`} — {item.price ?? '—'}
                </span>
                <button className="btn-ghost text-[10px]" onClick={() => handleWishlistRemove(Number(item.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Wishlist is empty.</p>
        )}
      </div>
    </div>
  );
}

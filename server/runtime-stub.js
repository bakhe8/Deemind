#!/usr/bin/env node
import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { composeStore, listStoreDemos, deepMerge as mergeStoreData } from '../tools/store-compose.js';

const app = express();
app.use(express.json());

const theme = process.argv[2] || 'demo';
const PORT = Number(process.env.PREVIEW_PORT || 4100);

const staticDir = path.resolve('preview-static', theme, 'pages');
const assetsDir = path.resolve('preview-static', theme);
const mockStorePath = path.resolve('data', 'mock-store.json');
const themeStorePath = path.resolve('data', `mock-store-${theme}.json`);
const localesDir = path.resolve('data', 'locales');
const stateRoot = path.resolve('runtime', 'state');
const themeStatePath = path.join(stateRoot, `${theme}.json`);
const localeOverrides = {};
const twilightDir = path.resolve('runtime', 'twilight');
const twilightConfigPath = path.join(twilightDir, 'config.json');

if (!fs.existsSync(staticDir)) {
  console.error(`❌ Static preview not found for theme "${theme}". Run "npm run preview:seed" first.`);
  process.exit(1);
}

const defaultState = {
  preset: null,
  store: { name: 'Deemind Demo', language: 'en', currency: 'SAR' },
  products: [],
  cart: { items: [], total: 0 },
  wishlist: { items: [] },
  session: { user: null, token: null },
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

async function readJsonSafe(file, fallback = defaultState) {
  try {
    return await fs.readJson(file);
  } catch (error) {
    console.warn(`⚠️ Failed to read ${file}. Using fallback state.`, error.message);
    return deepClone(fallback);
  }
}

async function buildSeedState() {
  const base = fs.existsSync(themeStorePath)
    ? await readJsonSafe(themeStorePath, defaultState)
    : await readJsonSafe(mockStorePath, defaultState);
  return {
    ...deepClone(defaultState),
    ...deepClone(base),
    cart: base.cart ? { items: base.cart.items || [], total: base.cart.total || 0 } : deepClone(defaultState.cart),
    wishlist: base.wishlist ? { items: base.wishlist.items || [] } : deepClone(defaultState.wishlist),
    session: base.session ? { user: base.session.user || null, token: base.session.token || null } : deepClone(defaultState.session),
    products: Array.isArray(base.products) ? base.products : [],
  };
}

async function loadRuntimeState({ forceSeed = false } = {}) {
  const seed = await buildSeedState();
  await fs.ensureDir(stateRoot);
  if (forceSeed || !(await fs.pathExists(themeStatePath))) {
    await fs.writeJson(themeStatePath, seed, { spaces: 2 });
    return deepClone(seed);
  }
  return readJsonSafe(themeStatePath, seed);
}

function cloneCart(cart) {
  const items = Array.isArray(cart?.items) ? cart.items.map((item) => ({ ...item })) : [];
  return { items, total: cart?.total || 0 };
}

function cloneWishlist(wishlist) {
  const items = Array.isArray(wishlist?.items) ? wishlist.items.map((item) => ({ ...item })) : [];
  return { items };
}

function cloneSession(session) {
  return { user: session?.user || null, token: session?.token || null };
}

const initialState = await loadRuntimeState();

let storeState = deepClone(initialState.store || {});
let productsState = Array.isArray(initialState.products) ? initialState.products.map((p) => ({ ...p })) : [];
let cartState = cloneCart(initialState.cart);
let wishlistState = cloneWishlist(initialState.wishlist);
let sessionState = cloneSession(initialState.session);
let presetState = initialState.preset || null;
let twilightEnabled = true;

if (fs.existsSync(twilightConfigPath)) {
  try {
    const twilightConfig = fs.readJsonSync(twilightConfigPath);
    twilightEnabled = Boolean(twilightConfig?.enabled ?? true);
  } catch {
    twilightEnabled = true;
  }
} else {
  fs.ensureDirSync(path.dirname(twilightConfigPath));
  fs.writeJsonSync(twilightConfigPath, { enabled: twilightEnabled }, { spaces: 2 });
}

const localeCode = storeState.language || 'en';

async function loadLocaleBundle(code) {
  if (localeOverrides[code]) {
    return deepClone(localeOverrides[code]);
  }
  const direct = path.join(localesDir, `${code}.json`);
  if (fs.existsSync(direct)) {
    return readJsonSafe(direct, {});
  }
  const fallback = path.join(localesDir, 'en.json');
  return fs.existsSync(fallback) ? readJsonSafe(fallback, {}) : {};
}

let translations = await loadLocaleBundle(localeCode);

async function setLocale(code) {
  const next = (code || 'en').toLowerCase();
  translations = await loadLocaleBundle(next);
  storeState.language = next;
  persistState();
  broadcast('store', { store: storeState, locale: translations });
  return { language: next, locale: translations };
}

const sseClients = new Set();

function applyState(next) {
  storeState = deepClone(next.store || {});
  productsState = Array.isArray(next.products) ? next.products.map((p) => ({ ...p })) : [];
  cartState = cloneCart(next.cart);
  wishlistState = cloneWishlist(next.wishlist);
  sessionState = cloneSession(next.session);
  presetState = next.preset || null;
}

function snapshotState() {
  return deepClone({
    preset: presetState,
    store: storeState,
    products: productsState,
    cart: cartState,
    wishlist: wishlistState,
    session: sessionState,
  });
}

function persistState() {
  fs.ensureDirSync(stateRoot);
  fs.writeJsonSync(themeStatePath, snapshotState(), { spaces: 2 });
}

async function resetRuntimeState() {
  const next = await loadRuntimeState({ forceSeed: true });
  applyState(next);
  translations = await loadLocaleBundle(storeState.language || 'en');
  persistState();
  broadcast('cart', cartState);
  broadcast('wishlist', wishlistState);
  broadcast('session', sessionState);
  broadcast('store', { store: storeState, locale: translations });
  return snapshotState();
}

function registerLocaleOverrides(locales = {}) {
  Object.entries(locales).forEach(([code, bundle]) => {
    localeOverrides[code] = deepClone(bundle);
  });
}

async function hydrateFromComposedStore(composed) {
  const payload = composed?.data || {};
  if (payload.store) {
    storeState = mergeStoreData(storeState, payload.store);
  }
  if (Array.isArray(payload.products)) {
    productsState = payload.products.map((p) => ({ ...p }));
  }
  if (payload.cart) {
    cartState = cloneCart(payload.cart);
  }
  if (payload.wishlist) {
    wishlistState = cloneWishlist(payload.wishlist);
  }
  if (payload.session) {
    sessionState = cloneSession(payload.session);
  }
  if (payload.locales) {
    registerLocaleOverrides(payload.locales);
  }
  presetState = {
    demo: composed.id,
    name: composed.name,
    partials: composed.partials,
    meta: composed.meta,
    generatedAt: composed.generatedAt,
  };
  const desiredLocale = composed.meta?.locale || payload.store?.language;
  if (desiredLocale) {
    await setLocale(desiredLocale);
  } else {
    persistState();
  }
  broadcast('cart', cartState);
  broadcast('wishlist', wishlistState);
  broadcast('session', sessionState);
  broadcast('store', { store: storeState, locale: translations });
  return snapshotState();
}

async function applyStorePreset({ demo = 'electronics', overrides = {}, includeOnly } = {}) {
  const composed = await composeStore(demo, { overrides, includeOnly, writeCache: true });
  const snapshot = await hydrateFromComposedStore(composed);
  return { composed, snapshot };
}

function persistTwilightConfig() {
  fs.ensureDirSync(path.dirname(twilightConfigPath));
  fs.writeJsonSync(twilightConfigPath, { enabled: twilightEnabled }, { spaces: 2 });
}

function twilightScriptTag() {
  if (!twilightEnabled || !fs.existsSync(path.join(twilightDir, 'twilight-shim.js'))) {
    return '';
  }
  return `<script defer src="/runtime-twilight/twilight-shim.js" data-twilight="enabled"></script>`;
}

function sendEvent(client, event, payload) {
  client.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event, payload) {
  for (const client of sseClients) {
    sendEvent(client, event, payload);
  }
}

function recalcCart() {
  cartState.total = cartState.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  persistState();
  broadcast('cart', cartState);
}

function injectRuntime(html) {
  const payload = {
    store: storeState,
    products: productsState,
    cart: cartState,
    locale: translations,
    wishlist: wishlistState,
    session: sessionState,
  };
  const script = `
    <script>
      (() => {
        const invoke = async (url, body = {}) =>
          (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

        window.__SALLA_STUB__ = ${JSON.stringify(payload).replace(/<\/script>/gi, '<\\/script>')};
        document.documentElement.lang = window.__SALLA_STUB__.store?.language || 'en';
        window.salla = window.salla || {};
        window.salla.t = (key) => (window.__SALLA_STUB__.locale && window.__SALLA_STUB__.locale[key]) || key;
        window.salla.cart = {
          addItem: (id, quantity = 1) => invoke('/api/cart/add', { id, quantity }),
          removeItem: (id) => invoke('/api/cart/remove', { id }),
          updateItem: (id, quantity) => invoke('/api/cart/update', { id, quantity }),
          clear: () => invoke('/api/cart/clear'),
          get: async () => (await fetch('/api/cart')).json(),
        };
        window.salla.wishlist = {
          add: (id) => invoke('/api/wishlist/add', { id }),
          remove: (id) => invoke('/api/wishlist/remove', { id }),
          toggle: (id) => invoke('/api/wishlist/toggle', { id }),
          clear: () => invoke('/api/wishlist/clear'),
          get: async () => (await fetch('/api/wishlist')).json(),
        };
        window.salla.auth = {
          login: (payload) => invoke('/api/auth/login', payload),
          logout: () => invoke('/api/auth/logout'),
          me: async () => (await fetch('/api/auth/me')).json(),
        };
        window.salla.locale = {
          set: (language) => invoke('/api/store/locale', { language }),
        };

        const updateCartBadge = (cart) => {
          const badge = document.querySelector('[data-cart-count]');
          if (!badge || !cart || !Array.isArray(cart.items)) return;
          const count = cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
          badge.textContent = count;
        };

        const updateWishlistBadge = (wishlist) => {
          const badge = document.querySelector('[data-wishlist-count]');
          if (!badge || !wishlist || !Array.isArray(wishlist.items)) return;
          badge.textContent = wishlist.items.length;
        };

        const syncWishlistButtons = () => {
          const wishlist = window.__SALLA_STUB__.wishlist || { items: [] };
          const items = Array.isArray(wishlist.items) ? wishlist.items : [];
          document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
            const id = Number(btn.dataset.wishlistToggle);
            const active = items.some((item) => Number(item.id) === id);
            btn.dataset.wishlistActive = active ? '1' : '0';
            btn.classList.toggle('is-active', active);
          });
        };

        const updateAuthState = (session) => {
          const isLoggedIn = Boolean(session?.user);
          document.querySelectorAll('[data-auth-state]').forEach((node) => {
            const mode = node.dataset.authState || 'guest';
            node.hidden = mode === 'guest' ? isLoggedIn : !isLoggedIn;
          });
          const nameTarget = document.querySelector('[data-auth-username]');
          if (nameTarget) {
            nameTarget.textContent = isLoggedIn ? session.user.name || session.user.email : '';
          }
        };

        document.addEventListener('click', async (evt) => {
          const cartAdd = evt.target.closest('[data-cart-add]');
          if (cartAdd) {
            evt.preventDefault();
            const id = Number(cartAdd.dataset.cartAdd);
            const qty = Number(cartAdd.dataset.cartQty || 1);
            cartAdd.disabled = true;
            try {
              const res = await window.salla.cart.addItem(id, qty);
              if (res?.cart) {
                window.__SALLA_STUB__.cart = res.cart;
                updateCartBadge(res.cart);
              }
            } finally {
              cartAdd.disabled = false;
            }
            return;
          }

          const cartRemove = evt.target.closest('[data-cart-remove]');
          if (cartRemove) {
            evt.preventDefault();
            const id = Number(cartRemove.dataset.cartRemove);
            const res = await window.salla.cart.removeItem(id);
            if (res?.cart) {
              window.__SALLA_STUB__.cart = res.cart;
              updateCartBadge(res.cart);
            }
            return;
          }

          const cartClear = evt.target.closest('[data-cart-clear]');
          if (cartClear) {
            evt.preventDefault();
            const res = await window.salla.cart.clear();
            if (res?.cart) {
              window.__SALLA_STUB__.cart = res.cart;
              updateCartBadge(res.cart);
            }
            return;
          }

          const wishlistToggle = evt.target.closest('[data-wishlist-toggle]');
          if (wishlistToggle) {
            evt.preventDefault();
            const id = Number(wishlistToggle.dataset.wishlistToggle);
            const res = await window.salla.wishlist.toggle(id);
            if (res?.wishlist) {
              window.__SALLA_STUB__.wishlist = res.wishlist;
              updateWishlistBadge(res.wishlist);
              syncWishlistButtons();
            }
            return;
          }

          const localeSwitch = evt.target.closest('[data-set-locale]');
          if (localeSwitch) {
            evt.preventDefault();
            const lang = localeSwitch.dataset.setLocale;
            await window.salla.locale.set(lang);
            return;
          }
        });

        document.addEventListener('submit', async (evt) => {
          const form = evt.target.closest('[data-auth-login-form]');
          if (!form) return;
          evt.preventDefault();
          const formData = new FormData(form);
          const payload = Object.fromEntries(formData.entries());
          const result = await window.salla.auth.login(payload);
          if (result?.user) {
            const session = { user: result.user, token: result.token };
            window.__SALLA_STUB__.session = session;
            updateAuthState(session);
          }
        });

        updateCartBadge(window.__SALLA_STUB__.cart);
        updateWishlistBadge(window.__SALLA_STUB__.wishlist);
        updateAuthState(window.__SALLA_STUB__.session);
        syncWishlistButtons();

        const source = new EventSource('/events');
        const handle = (evt, cb) => {
          try {
            const data = JSON.parse(evt.data);
            cb(data);
          } catch (error) {
            console.warn('SSE parse error', error);
          }
        };

        source.addEventListener('cart', (evt) =>
          handle(evt, (cart) => {
            window.__SALLA_STUB__.cart = cart;
            updateCartBadge(cart);
          }),
        );
        source.addEventListener('wishlist', (evt) =>
          handle(evt, (wishlist) => {
            window.__SALLA_STUB__.wishlist = wishlist;
            updateWishlistBadge(wishlist);
            syncWishlistButtons();
          }),
        );
        source.addEventListener('session', (evt) =>
          handle(evt, (session) => {
            window.__SALLA_STUB__.session = session;
            updateAuthState(session);
          }),
        );
        source.addEventListener('store', (evt) =>
          handle(evt, (payload) => {
            window.__SALLA_STUB__.store = payload.store;
            window.__SALLA_STUB__.locale = payload.locale;
            document.documentElement.lang = payload.store.language || 'en';
          }),
        );
        source.onerror = (error) => console.warn('SSE connection issue', error);
      })();
    </script>
  `;
  const twilightTag = twilightScriptTag();
  return html.replace('</body>', `${script}${twilightTag ? `\n${twilightTag}` : ''}\n</body>`);
}

function sendPage(res, slug) {
  const cleanSlug = slug.replace(/^\/+/, '');
  const filePath = path.join(staticDir, `${cleanSlug || 'index'}.html`);
  if (!fs.existsSync(filePath)) {
    res.status(404).send(`<p>Preview not found for /${cleanSlug}</p>`);
    return;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  res.send(injectRuntime(html));
}

// Mock API routes
app.get('/api/state', (_req, res) => res.json(snapshotState()));
app.post('/api/state/reset', async (_req, res) => {
  const next = await resetRuntimeState();
  res.json({ success: true, state: next });
});
app.get('/api/store/demos', async (_req, res) => {
  try {
    const demos = await listStoreDemos();
    res.json({ demos });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
app.get('/api/store/compose', async (req, res) => {
  try {
    const demo = String(req.query.demo || 'electronics');
    const includeOnly = req.query.parts
      ? String(req.query.parts)
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : undefined;
    const composed = await composeStore(demo, { includeOnly, writeCache: false });
    res.json(composed);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});
app.post('/api/store/preset', async (req, res) => {
  try {
    const { demo = 'electronics', overrides = {}, includeOnly } = req.body || {};
    const includeList = Array.isArray(includeOnly) ? includeOnly : undefined;
    const result = await applyStorePreset({ demo, overrides, includeOnly: includeList });
    res.json({
      success: true,
      demo,
      state: result.snapshot,
      meta: result.composed.meta,
      partials: result.composed.partials,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/twilight', (_req, res) => {
  res.json({ enabled: twilightEnabled });
});

app.post('/api/twilight', (req, res) => {
  twilightEnabled = Boolean(req.body?.enabled);
  persistTwilightConfig();
  broadcast('twilight', { enabled: twilightEnabled });
  res.json({ enabled: twilightEnabled });
});
app.get('/api/store', (_, res) => res.json(storeState));
app.get('/api/products', (_, res) => res.json(productsState));
app.get('/api/cart', (_, res) => res.json(cartState));
app.get('/api/wishlist', (_, res) => res.json(wishlistState));
app.get('/api/locale', (_req, res) => res.json({ language: storeState.language, locale: translations }));

app.post('/api/store/locale', async (req, res) => {
  const next = (req.body?.language || req.body?.code || req.body?.locale || '').trim() || 'en';
  const result = await setLocale(next);
  res.json({ success: true, ...result });
});

app.post('/api/cart/add', (req, res) => {
  const id = Number(req.body.id);
  const qty = Number(req.body.quantity ?? 1);
  const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const product = productsState.find((p) => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  const existing = cartState.items.find((item) => item.id === id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cartState.items.push({ ...product, quantity });
  }
  recalcCart();
  res.json({ success: true, cart: cartState });
});

app.post('/api/cart/remove', (req, res) => {
  const id = Number(req.body.id);
  cartState.items = cartState.items.filter((item) => item.id !== id);
  recalcCart();
  res.json({ success: true, cart: cartState });
});

app.post('/api/cart/update', (req, res) => {
  const id = Number(req.body.id);
  const qty = Number(req.body.quantity ?? 1);
  const item = cartState.items.find((entry) => entry.id === id);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
  item.quantity = Math.max(1, Number.isFinite(qty) ? qty : 1);
  recalcCart();
  res.json({ success: true, cart: cartState });
});

app.post('/api/cart/clear', (_req, res) => {
  cartState.items = [];
  recalcCart();
  res.json({ success: true, cart: cartState });
});

app.post('/api/wishlist/add', (req, res) => {
  const id = Number(req.body.id);
  const product = productsState.find((p) => p.id === id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  if (!wishlistState.items.find((item) => item.id === id)) {
    wishlistState.items.push(product);
    persistState();
    broadcast('wishlist', wishlistState);
  }
  res.json({ success: true, wishlist: wishlistState });
});

app.post('/api/wishlist/remove', (req, res) => {
  const id = Number(req.body.id);
  wishlistState.items = wishlistState.items.filter((item) => item.id !== id);
  persistState();
  broadcast('wishlist', wishlistState);
  res.json({ success: true, wishlist: wishlistState });
});

app.post('/api/wishlist/toggle', (req, res) => {
  const id = Number(req.body.id);
  const existing = wishlistState.items.find((item) => item.id === id);
  if (existing) {
    wishlistState.items = wishlistState.items.filter((item) => item.id !== id);
  } else {
    const product = productsState.find((p) => p.id === id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    wishlistState.items.push(product);
  }
  persistState();
  broadcast('wishlist', wishlistState);
  res.json({ success: true, wishlist: wishlistState });
});

app.post('/api/wishlist/clear', (_req, res) => {
  wishlistState.items = [];
  persistState();
  broadcast('wishlist', wishlistState);
  res.json({ success: true, wishlist: wishlistState });
});

app.post('/api/auth/login', (req, res) => {
  const { email = 'demo@deemind.local', name = 'Deemind User' } = req.body || {};
  sessionState.user = { email, name };
  sessionState.token = `stub-${Date.now()}`;
  persistState();
  broadcast('session', sessionState);
  res.json({ success: true, token: sessionState.token, user: sessionState.user });
});

app.post('/api/auth/logout', (_req, res) => {
  sessionState.user = null;
  sessionState.token = null;
  persistState();
  broadcast('session', sessionState);
  res.json({ success: true });
});

app.get('/api/auth/me', (_req, res) => {
  res.json({ user: sessionState.user, token: sessionState.token });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  sendEvent(res, 'cart', cartState);
  sendEvent(res, 'wishlist', wishlistState);
  sendEvent(res, 'session', sessionState);
  sendEvent(res, 'store', { store: storeState, locale: translations });
  sendEvent(res, 'twilight', { enabled: twilightEnabled });
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Static assets
app.use('/preview-assets', express.static(assetsDir));
if (fs.existsSync(twilightDir)) {
  app.use('/runtime-twilight', express.static(twilightDir));
}

// Routes
app.get('/', (req, res) => sendPage(res, 'index'));
app.get('/pages', (req, res) => {
  const list = fs
    .readdirSync(staticDir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        const sub = fs
          .readdirSync(path.join(staticDir, entry.name))
          .filter((file) => file.endsWith('.html'))
          .map((file) => `${entry.name}/${file.replace(/\.html$/, '')}`);
        return sub;
      }
      if (entry.name.endsWith('.html')) return [entry.name.replace(/\.html$/, '')];
      return [];
    })
    .sort();
  res.send(
    `<h1>Mock Preview Pages</h1><ul>${list
      .map((slug) => `<li><a href="/page/${slug}">${slug}</a></li>`)
      .join('')}</ul>`,
  );
});

app.get(/^\/page\/(.*)/, (req, res) => sendPage(res, req.params[0]));

app.listen(PORT, () => {
  console.log(`🟢 Salla runtime stub running at http://localhost:${PORT}/page/index`);
});

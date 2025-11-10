#!/usr/bin/env node
import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { composeStore, listStoreDemos, deepMerge as mergeStoreData } from '../tools/store-compose.js';
import { buildMockContext, writeMockContext } from '../tools/mock-layer/mock-data-builder.js';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api/')) return;
    logAnalytics({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  next();
});

const theme = process.argv[2] || 'demo';
const PORT = Number(process.env.PREVIEW_PORT || 4100);

const themeOutputRoot = path.resolve('output', theme);
const staticDir = path.join(themeOutputRoot, 'pages');
const assetsDir = themeOutputRoot;
const mockStorePath = path.resolve('mockups', 'store', 'cache', 'context', `${theme}.json`);
const themeStorePath = path.resolve('data', `mock-store-${theme}.json`);
const localesDir = path.resolve('data', 'locales');
const sessionRoot = process.env.RUNTIME_SESSION_ROOT
  ? path.resolve(process.env.RUNTIME_SESSION_ROOT)
  : path.resolve('runtime', 'sessions', theme);
const stateRoot = process.env.RUNTIME_STATE_DIR
  ? path.resolve(process.env.RUNTIME_STATE_DIR)
  : path.join(sessionRoot, 'state');
const runtimeStateFile = process.env.RUNTIME_STATE_FILE
  ? path.resolve(process.env.RUNTIME_STATE_FILE)
  : path.join(stateRoot, 'state.json');
const legacyStateFile = path.resolve('runtime', 'state', `${theme}.json`);
const localeOverrides = {};
const twilightDir = path.resolve('runtime', 'twilight');
const twilightConfigPath = path.join(twilightDir, 'config.json');
const analyticsLogPath = process.env.RUNTIME_ANALYTICS_LOG
  ? path.resolve(process.env.RUNTIME_ANALYTICS_LOG)
  : path.join(sessionRoot, 'logs', 'runtime-analytics.jsonl');

if (!fs.existsSync(staticDir)) {
  console.error(`❌ Built preview not found for theme "${theme}". Run "npm run deemind:build ${theme}" first.`);
  process.exit(1);
}

const defaultState = {
  preset: null,
  store: { name: 'Deemind Demo', language: 'en', currency: 'SAR' },
  products: [],
  cart: { items: [], total: 0 },
  wishlist: { items: [] },
  session: { user: null, token: null },
  locales: {},
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
  const hasThemeStore = await fs.pathExists(themeStorePath);
  const hasCacheStore = await fs.pathExists(mockStorePath);
  const base = hasThemeStore
    ? await readJsonSafe(themeStorePath, defaultState)
    : hasCacheStore
    ? await readJsonSafe(mockStorePath, defaultState)
    : defaultState;
  return {
    ...deepClone(defaultState),
    ...deepClone(base),
    cart: base.cart ? { items: base.cart.items || [], total: base.cart.total || 0 } : deepClone(defaultState.cart),
    wishlist: base.wishlist ? { items: base.wishlist.items || [] } : deepClone(defaultState.wishlist),
    session: base.session ? { user: base.session.user || null, token: base.session.token || null } : deepClone(defaultState.session),
    products: Array.isArray(base.products) ? base.products : [],
    locales: base.locales || {},
  };
}

async function loadRuntimeState({ forceSeed = false } = {}) {
  const seed = await buildSeedState();
  await fs.ensureDir(stateRoot);
  const hasSessionState = await fs.pathExists(runtimeStateFile);
  const hasLegacyState = await fs.pathExists(legacyStateFile);

  if (forceSeed || (!hasSessionState && !hasLegacyState)) {
    persistSnapshot(seed);
    return deepClone(seed);
  }

  if (!hasSessionState && hasLegacyState) {
    const legacy = await readJsonSafe(legacyStateFile, seed);
    persistSnapshot(legacy);
    return deepClone(legacy);
  }

  return readJsonSafe(runtimeStateFile, seed);
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
let navigationState = Array.isArray(initialState.navigation) ? initialState.navigation.map((item) => ({ ...item })) : [];
let heroState = deepClone(initialState.hero || {});
let categoriesState = Array.isArray(initialState.categories) ? initialState.categories.map((item) => ({ ...item })) : [];
let userState = initialState.user ? { ...initialState.user } : null;
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

fs.ensureDirSync(path.dirname(analyticsLogPath));

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
  broadcast('store', {
    store: storeState,
    locale: translations,
    navigation: navigationState,
    hero: heroState,
    categories: categoriesState,
    user: userState,
  });
  broadcast('context', snapshotState());
  return { language: next, locale: translations };
}

const sseClients = new Set();

function applyState(next) {
  storeState = deepClone(next.store || {});
  productsState = Array.isArray(next.products) ? next.products.map((p) => ({ ...p })) : [];
  cartState = cloneCart(next.cart);
  wishlistState = cloneWishlist(next.wishlist);
  sessionState = cloneSession(next.session);
  navigationState = Array.isArray(next.navigation) ? next.navigation.map((item) => ({ ...item })) : [];
  heroState = deepClone(next.hero || {});
  categoriesState = Array.isArray(next.categories) ? next.categories.map((item) => ({ ...item })) : [];
  userState = next.user ? { ...next.user } : null;
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
    navigation: navigationState,
    hero: heroState,
    categories: categoriesState,
    user: userState,
    locales: translations,
    meta: {
      theme,
      preset: presetState?.demo || null,
      generatedAt: new Date().toISOString(),
    },
  });
}

function persistState() {
  persistSnapshot(snapshotState());
}

function persistSnapshot(snapshot) {
  fs.ensureDirSync(stateRoot);
  fs.writeJsonSync(runtimeStateFile, snapshot, { spaces: 2 });
  if (legacyStateFile !== runtimeStateFile) {
    fs.ensureDirSync(path.dirname(legacyStateFile));
    fs.writeJsonSync(legacyStateFile, snapshot, { spaces: 2 });
  }
  return snapshot;
}

async function resetRuntimeState() {
  const next = await loadRuntimeState({ forceSeed: true });
  applyState(next);
  translations = await loadLocaleBundle(storeState.language || 'en');
  persistState();
  broadcast('cart', cartState);
  broadcast('wishlist', wishlistState);
  broadcast('session', sessionState);
  broadcast('store', {
    store: storeState,
    locale: translations,
    navigation: navigationState,
    hero: heroState,
    categories: categoriesState,
    user: userState,
  });
  broadcast('context', snapshotState());
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
  broadcast('store', {
    store: storeState,
    locale: translations,
    navigation: navigationState,
    hero: heroState,
    categories: categoriesState,
    user: userState,
  });
  broadcast('context', snapshotState());
  return snapshotState();
}

async function applyStorePreset({ demo = 'electronics', overrides = {}, includeOnly } = {}) {
  const composed = await composeStore(demo, { overrides, includeOnly, writeCache: true });
  try {
    const context = await buildMockContext(demo);
    await writeMockContext(theme, context);
  } catch (error) {
    console.warn(`⚠️ Failed to refresh mock context for preset ${demo}:`, error.message || error);
  }
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
  const payload = snapshotState();
  const script = `
    <script>
      (() => {
        const invoke = async (url, body = {}) =>
          (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

        window.__SALLA_STUB__ = ${JSON.stringify(payload).replace(/<\/script>/gi, '<\\/script>')};
        document.documentElement.lang = window.__SALLA_STUB__.store?.language || 'en';
        window.salla = window.salla || {};
        window.salla.t = (key) => {
          const bundles = window.__SALLA_STUB__.locales || {};
          return bundles[key] || key;
        };
        window.salla.cart = window.salla.cart || {};
        window.salla.cart.event = window.salla.cart.event || cartEventApi;
        window.salla.cart.addItem = async (id, quantity = 1) => {
          try {
            const result = await invoke('/api/cart/add', { id, quantity });
            cartEvents.emit('item:updated', result);
            cartEvents.emit('updated', result);
            globalEvents.emit('cart:updated', result);
            window.salla.event.cart?.onUpdated?.((fn) => fn?.(result));
            return result;
          } catch (error) {
            cartEvents.emit('item:failed', { id, quantity, error });
            throw error;
          }
        };
        window.salla.cart.removeItem = async (id) => {
          const result = await invoke('/api/cart/remove', { id });
          cartEvents.emit('item:updated', result);
          cartEvents.emit('updated', result);
          globalEvents.emit('cart:updated', result);
          return result;
        };
        window.salla.cart.updateItem = async (id, quantity) => {
          try {
            const result = await invoke('/api/cart/update', { id, quantity });
            cartEvents.emit('item:updated', result);
            cartEvents.emit('updated', result);
            globalEvents.emit('cart:updated', result);
            return result;
          } catch (error) {
            cartEvents.emit('item:failed', { id, quantity, error });
            throw error;
          }
        };
        window.salla.cart.clear = async () => {
          const result = await invoke('/api/cart/clear');
          cartEvents.emit('updated', result);
          globalEvents.emit('cart:updated', result);
          return result;
        };
        window.salla.cart.get = async () => (await fetch('/api/cart')).json();
        window.salla.cart.submit = async () => {
          const id = window.salla.api.cart.getCurrentCartId();
          orderEvents.emit('invoice', { id });
          return { success: true, id };
        };
        window.salla.wishlist = window.salla.wishlist || {};
        window.salla.wishlist.add = async (id) => {
          const result = await invoke('/api/wishlist/add', { id });
          wishlistEvents.emit('added', result);
          globalEvents.emit('wishlist:updated', result);
          return result;
        };
        window.salla.wishlist.remove = async (id) => {
          const result = await invoke('/api/wishlist/remove', { id });
          wishlistEvents.emit('removed', result);
          globalEvents.emit('wishlist:updated', result);
          return result;
        };
        window.salla.wishlist.toggle = async (id) => {
          const result = await invoke('/api/wishlist/toggle', { id });
          globalEvents.emit('wishlist:updated', result);
          return result;
        };
        window.salla.wishlist.clear = async () => {
          const result = await invoke('/api/wishlist/clear');
          globalEvents.emit('wishlist:updated', result);
          return result;
        };
        window.salla.wishlist.get = async () => (await fetch('/api/wishlist')).json();
        window.salla.auth = window.salla.auth || {
          login: (payload) => invoke('/api/auth/login', payload),
          logout: () => invoke('/api/auth/logout'),
          me: async () => (await fetch('/api/auth/me')).json(),
        };
        window.salla.locale = {
          set: (language) => invoke('/api/store/locale', { language }),
        };

        const createEmitter = () => {
          const listeners = new Map();
          return {
            on(event, handler) {
              if (!event || typeof handler !== 'function') return () => {};
              if (!listeners.has(event)) listeners.set(event, new Set());
              listeners.get(event).add(handler);
              return () => listeners.get(event)?.delete(handler);
            },
            off(event, handler) {
              if (!listeners.has(event)) return;
              if (!handler) {
                listeners.delete(event);
                return;
              }
              listeners.get(event)?.delete(handler);
            },
            emit(event, payload) {
              if (!listeners.has(event)) return;
              listeners.get(event).forEach((handler) => {
                try {
                  handler(payload);
                } catch (error) {
                  console.warn('[salla:event]', event, error);
                }
              });
            },
          };
        };

        const globalEvents = createEmitter();
        const cartEvents = createEmitter();
        const wishlistEvents = createEmitter();
        const orderEvents = createEmitter();
        const commentEvents = createEmitter();
        const documentEvents = createEmitter();
        let customNotifier = null;

        const cartEventApi = {
          onUpdated: (handler) => cartEvents.on('updated', handler),
          onItemUpdated: (handler) => cartEvents.on('item:updated', handler),
          onItemUpdatedFailed: (handler) => cartEvents.on('item:failed', handler),
        };
        const wishlistEventApi = {
          onAdded: (handler) => wishlistEvents.on('added', handler),
          onRemoved: (handler) => wishlistEvents.on('removed', handler),
        };
        const orderEventApi = {
          onInvoiceSent: (handler) => orderEvents.on('invoice', handler),
        };
        const commentEventApi = {
          onAdded: (handler) => commentEvents.on('added', handler),
        };

        window.salla.event = window.salla.event || {};
        window.salla.event.dispatch = (name, payload) => globalEvents.emit(name, payload);
        window.salla.event.on = (name, handler) => globalEvents.on(name, handler);
        window.salla.event.off = (name, handler) => globalEvents.off(name, handler);
        window.salla.event.document = window.salla.event.document || {};
        window.salla.event.document.onClick = (handler) => documentEvents.on('click', handler);
        window.salla.event.cart = window.salla.event.cart || cartEventApi;
        window.salla.wishlist = window.salla.wishlist || {};
        window.salla.wishlist.event = window.salla.wishlist.event || wishlistEventApi;
        window.salla.order = window.salla.order || {};
        window.salla.order.event = window.salla.order.event || orderEventApi;
        window.salla.comment = window.salla.comment || {};
        window.salla.comment.event = window.salla.comment.event || commentEventApi;
        window.salla.onReady = window.salla.onReady || ((handler) => {
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            queueMicrotask(handler);
          } else {
            document.addEventListener('DOMContentLoaded', handler, { once: true });
          }
        });
        window.salla.lang = window.salla.lang || {};
        window.salla.lang.onLoaded = (handler) => {
          if (typeof handler === 'function') handler(window.__SALLA_STUB__.locales || {});
        };
        window.salla.logger = window.salla.logger || {
          warn: (...args) => console.warn('[salla]', ...args),
          error: (...args) => console.error('[salla]', ...args),
        };
        window.salla.log = (...args) => console.log('[salla]', ...args);
        window.salla.notify = window.salla.notify || {
          error: (message) => {
            if (typeof customNotifier === 'function') {
              customNotifier({ type: 'error', message });
            } else {
              console.error('[salla.notify]', message);
              alert(typeof message === 'string' ? message : 'An error occurred');
            }
          },
          setNotifier: (fn) => {
            customNotifier = typeof fn === 'function' ? fn : null;
          },
        };
        window.salla.helpers = window.salla.helpers || {};
        window.salla.helpers.addParamToUrl = (url, key, value) => {
          try {
            const parsed = new URL(url, window.location.origin);
            parsed.searchParams.set(key, value);
            return parsed.toString();
          } catch {
            return url;
          }
        };
        window.salla.helpers.number = (value) => Number(value) || 0;
        window.salla.helpers.inputDigitsOnly = (value = '') => String(value).replace(/\D+/g, '');
        window.salla.form = window.salla.form || {};
        window.salla.form.onChange = (_action, event) => {
          if (event?.preventDefault) event.preventDefault();
          return Promise.resolve();
        };
        window.salla.storage = window.salla.storage || {
          get: (key) => {
            try {
              return window.localStorage.getItem(key);
            } catch {
              return null;
            }
          },
        };
        window.salla.config = window.salla.config || {
          isGuest: () => !window.__SALLA_STUB__.session?.user,
        };
        window.salla.url = window.salla.url || {
          asset: (path) => {
            if (typeof path === 'string' && path.indexOf('http') === 0) return path;
            const baseOrigin = (window.location && window.location.origin) || '';
            const normalizedBase = baseOrigin.endsWith('/') ? baseOrigin.slice(0, -1) : baseOrigin;
            const cleanPath = path ? String(path).replace(/^\/+/, '') : '';
            return normalizedBase + '/' + cleanPath;
          },
          is_placeholder: (url) => !url || url === '#' || url.startsWith('javascript:'),
          is_page: (url) => typeof url === 'string' && /^https?:\/\//i.test(url) === false,
        };
        window.salla.money = window.salla.money || {
          format: (amount, currency = window.__SALLA_STUB__.store?.currency || 'SAR') =>
            new Intl.NumberFormat(window.__SALLA_STUB__.store?.language || 'en', {
              style: 'currency',
              currency,
            }).format(Number(amount) || 0),
        };
        window.salla.api = window.salla.api || {};
        window.salla.api.request = async (endpoint, options = {}) => {
          const response = await fetch(endpoint, {
            method: options.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options.body || {}),
          });
          return response.json();
        };
        window.salla.api.component = window.salla.api.component || {
          getMenus: async () => window.__SALLA_STUB__.navigation || [],
        };
        window.salla.api.cart = window.salla.api.cart || {};
        window.salla.api.cart.getCurrentCartId = () => window.__SALLA_STUB__.cart?.id || 'deemind-cart';
        window.salla.api.cart.get = async () => window.__SALLA_STUB__.cart || {};
        window.salla.products = window.salla.products || {};
        window.salla.products.featured = async (options = {}) => {
          const list = Array.isArray(window.__SALLA_STUB__.products) ? window.__SALLA_STUB__.products : [];
          const limit = Number(options.limit);
          return Number.isFinite(limit) && limit > 0 ? list.slice(0, limit) : list;
        };
        document.addEventListener('click', (event) => documentEvents.emit('click', event));

        const registerSallaPlaceholders = () => {
          if (!window.customElements) return;
          const tags = [
            'salla-reviews',
            'salla-products-slider',
            'salla-slider',
            'salla-products-list',
            'salla-button',
            'salla-rating-stars',
            'salla-menu',
            'salla-localization-modal',
            'salla-search',
            'salla-contacts',
            'salla-user-menu',
            'salla-cart-summary',
            'salla-scopes',
            'salla-social',
            'salla-modal',
            'salla-apps-icons',
            'salla-payments',
            'salla-breadcrumb',
            'salla-comments',
            'salla-loyalty',
            'salla-count-down',
            'salla-mini-checkout-widget',
            'salla-conditional-offer',
            'salla-cart-item-offers',
            'salla-quantity-input',
            'salla-offer',
            'salla-gifting',
            'salla-tiered-offer',
            'salla-social-share',
            'salla-installment',
            'salla-metadata',
            'salla-add-product-button',
            'salla-filters',
            'salla-product-options',
            'salla-multiple-bundle-product',
            'salla-product-size-guide',
            'salla-file-upload',
            'salla-wallet',
            'salla-datetime-picker',
            'salla-tel-input',
            'salla-verify',
            'salla-user-settings',
            'salla-notifications',
            'salla-order-details',
            'salla-order-totals-card',
            'salla-rating-modal',
            'salla-orders',
            'salla-infinite-scroll'
          ];
          tags.forEach((tag) => {
            if (window.customElements.get(tag)) return;
            window.customElements.define(
              tag,
              class extends HTMLElement {
                connectedCallback() {
                  if (this.dataset.placeholderInitialized) return;
                  this.dataset.placeholderInitialized = '1';
                  if (!this.innerHTML.trim()) {
                    const markup =
                      '<div style="padding:0.75rem;border:1px dashed rgba(148,163,184,.4);border-radius:0.5rem;font-size:0.8rem;color:#475569;">' +
                      tag +
                      ' placeholder</div>';
                    this.innerHTML = markup;
                  }
                }
              }
            );
          });
        };
        registerSallaPlaceholders();

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
            window.__SALLA_STUB__.locales = payload.locale;
            window.__SALLA_STUB__.navigation = payload.navigation || window.__SALLA_STUB__.navigation || [];
            window.__SALLA_STUB__.hero = payload.hero || window.__SALLA_STUB__.hero || {};
            document.documentElement.lang = (payload.store && payload.store.language) || 'en';
          }),
        );
        source.addEventListener('context', (evt) =>
          handle(evt, (snapshot) => {
            window.__SALLA_STUB__ = snapshot;
            updateCartBadge(snapshot.cart);
            updateWishlistBadge(snapshot.wishlist);
            syncWishlistButtons();
            updateAuthState(snapshot.session);
            document.documentElement.lang = (snapshot.store && snapshot.store.language) || 'en';
          }),
        );
        source.onerror = (error) => console.warn('SSE connection issue', error);
      })();
    </script>
  `;
  const twilightTag = twilightScriptTag();
  return html.replace('</body>', `${script}${twilightTag ? `\n${twilightTag}` : ''}\n</body>`);
}

function logAnalytics(entry) {
  const payload = {
    ts: new Date().toISOString(),
    preset: presetState?.demo || null,
    theme,
    ...entry,
  };
  fs.appendFile(analyticsLogPath, `${JSON.stringify(payload)}\n`).catch(() => undefined);
  broadcast('analytics', payload);
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
app.get('/api/runtime/context', (_req, res) => res.json(snapshotState()));
app.post('/api/runtime/context/regenerate', async (req, res) => {
  const demo = String(req.body?.demo || presetState?.demo || theme || 'electronics');
  try {
    const context = await buildMockContext(demo);
    await writeMockContext(theme, context);
    const state = await resetRuntimeState();
    res.json({ success: true, demo, state });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
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
app.use('/assets', express.static(path.join(themeOutputRoot, 'assets')));
app.use('/public', express.static(path.join(themeOutputRoot, 'public')));
app.use('/static', express.static(themeOutputRoot));
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

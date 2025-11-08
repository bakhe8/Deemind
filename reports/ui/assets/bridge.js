/* eslint-env browser */

import { DOC_ROOT } from './ui.js';

const listeners = new Set();
let cache = null;
let lastFetch = 0;

async function fetchJson(path) {
  const url = `${path}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

async function loadBridgeData() {
  try {
    const data = await fetchJson('./data/bridge.json');
    cache = data;
    lastFetch = Date.now();
    listeners.forEach((fn) => fn(cache));
  } catch (error) {
    console.warn('[bridge] unable to load data', error);
  }
}

function subscribe(fn) {
  listeners.add(fn);
  if (cache) {
    fn(cache);
  } else if (!lastFetch) {
    loadBridgeData();
  }
  return () => listeners.delete(fn);
}

setInterval(() => loadBridgeData(), 60000);
loadBridgeData();

export const Bridge = {
  subscribe,
  refresh: loadBridgeData,
  get data() {
    return cache;
  },
  docRoot: DOC_ROOT,
};

// Fetches Salla docs pages, scrapes useful hints (layout hooks, helpers, filters,
// component categories) and writes a knowledge JSON for adapter/validator usage.
// Safe heuristic scraper; falls back to defaults if fetch or parse fails.

import fs from 'fs';
import path from 'path';

const URLS = [
  'https://docs.salla.dev/421943m0#locate-layout-files',
  'https://docs.salla.dev/421943m0#master-layout-hooks',
  'https://docs.salla.dev/421943m0#using-layouts',
  'https://docs.salla.dev/421943m0#build-a-new-layout',
  'https://docs.salla.dev/421943m0',
  'https://docs.salla.dev/421886m0',
  'https://docs.salla.dev/421929m0#helpers',
  'https://docs.salla.dev/421929m0#filters',
  'https://docs.salla.dev/422580m0',
  'https://docs.salla.dev/422580m0#home-components',
  'https://docs.salla.dev/422580m0#header-components',
  'https://docs.salla.dev/422580m0#footer-components',
  'https://docs.salla.dev/422580m0#products-components',
  'https://docs.salla.dev/422556m0',
  "https://docs.salla.dev/422610m0#sdk's-main-apis"
];

const OUT = path.resolve('configs', 'knowledge', 'salla-docs.json');

function ensureDir(p){ fs.mkdirSync(path.dirname(p), { recursive: true }); }

function defaultHints(){
  return {
    layouts: {
      masterHooks: ['head', 'header', 'content', 'footer', 'scripts'],
      files: ['layout/default.twig']
    },
    helpers: [],
    filters: ['t', 'escape', 'raw'],
    components: {
      home: [],
      header: [],
      footer: [],
      products: []
    },
    sdk: { apis: [], deprecated: [] },
    webComponents: { tags: [] },
    fetched: false,
    fetchedAt: new Date().toISOString()
  };
}

function scrape(html){
  const hints = defaultHints();
  // crude code fence and inline twig scanning
  const codeBlocks = Array.from(html.matchAll(/<code[^>]*>([\s\s\S]*?)<\/code>/gi)).map(m=>m[1]);
  const preBlocks  = Array.from(html.matchAll(/<pre[^>]*>([\s\s\S]*?)<\/pre>/gi)).map(m=>m[1]);
  const text = [html, ...codeBlocks, ...preBlocks].join('\n');
  const hookMatches = Array.from(text.matchAll(/\{%\s*block\s+([A-Za-z0-9_-]+)\s*%\}/g)).map(m=>m[1]);
  if (hookMatches.length) {
    const set = new Set([...hints.layouts.masterHooks, ...hookMatches]);
    hints.layouts.masterHooks = Array.from(set);
  }
  const helperMatches = Array.from(text.matchAll(/\bsalla\.[A-Za-z0-9_.]+/g)).map(m=>m[0]);
  if (helperMatches.length) hints.helpers = Array.from(new Set([...hints.helpers, ...helperMatches]));
  const filterMatches = Array.from(text.matchAll(/\|\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g)).map(m=>m[1]);
  if (filterMatches.length) hints.filters = Array.from(new Set([...hints.filters, ...filterMatches]));
  const headings = Array.from(html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)).map(m=>m[1].replace(/<[^>]+>/g,'').trim().toLowerCase());
  function pick(group){ return headings.filter(h => h.includes(group)).slice(0,30); }
  const home = pick('home'); if (home.length) hints.components.home = Array.from(new Set([...hints.components.home, ...home]));
  const header = pick('header'); if (header.length) hints.components.header = Array.from(new Set([...hints.components.header, ...header]));
  const footer = pick('footer'); if (footer.length) hints.components.footer = Array.from(new Set([...hints.components.footer, ...footer]));
  const products = pick('product'); if (products.length) hints.components.products = Array.from(new Set([...hints.components.products, ...products]));
  // SDK main API identifiers (salla.*, Salla.*, SDK.*)
  const sdkMatches = Array.from(text.matchAll(/\b(?:salla|Salla|SDK)\.[A-Za-z0-9_.]+/g)).map(m=>m[0]);
  if (sdkMatches.length) hints.sdk.apis = Array.from(new Set([...(hints.sdk.apis||[]), ...sdkMatches]));
  // Custom elements (web components), prefer salla-* tags
  const tagMatches = Array.from(html.matchAll(/<\s*([a-z][a-z0-9-]+)(\s|>)/g)).map(m=>m[1]).filter(t=>t.includes('-'));
  const sallaTags = tagMatches.filter(t => t.toLowerCase().startsWith('salla-'));
  if (sallaTags.length) hints.webComponents.tags = Array.from(new Set([...(hints.webComponents.tags||[]), ...sallaTags]));
  hints.fetched = true;
  hints.fetchedAt = new Date().toISOString();
  return hints;
}

async function fetchAll(){
  let hints = defaultHints();
  for (const url of URLS) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Deemind/1.0' } });
      if (!res.ok) continue;
      const html = await res.text();
      const part = scrape(html);
      // merge
      const mergeSet = (a,b)=>Array.from(new Set([...(a||[]), ...(b||[])]));
      hints.layouts.masterHooks = mergeSet(hints.layouts.masterHooks, part.layouts.masterHooks);
      hints.helpers = mergeSet(hints.helpers, part.helpers);
      hints.filters = mergeSet(hints.filters, part.filters);
      if (part.sdk && Array.isArray(part.sdk.apis)) {
        hints.sdk.apis = mergeSet(hints.sdk.apis, part.sdk.apis);
      }
      if (part.webComponents && Array.isArray(part.webComponents.tags)) {
        hints.webComponents.tags = mergeSet(hints.webComponents.tags, part.webComponents.tags);
      }
      Object.keys(hints.components).forEach(k => {
        hints.components[k] = mergeSet(hints.components[k], part.components[k]||[]);
      });
      hints.fetched = hints.fetched || part.fetched;
      hints.fetchedAt = new Date().toISOString();
    } catch (e) {
      // ignore
    }
  }
  ensureDir(OUT);
  fs.writeFileSync(OUT, JSON.stringify(hints, null, 2));
  console.log('Wrote', OUT);
}

fetchAll().catch(e=>{ console.error(e); process.exit(1); });



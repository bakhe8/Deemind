import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { BRAND_FONT_CACHE_DIR } from './constants.js';

const FONT_FAMILY_DECL_RE = /font-family:\s*([^;]+);/gi;
const FONT_FACE_RE = /@font-face\s*{[^}]*font-family:\s*([^;]+);[^}]*}/gi;
const CSS_LINK_RE = /<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
const INLINE_STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const IMPORT_RE = /@import\s+url\(([^)]+)\)/gi;

function normalizeFontName(raw: string) {
  return raw
    .split(',')
    .map((entry) => entry.replace(/['"]/g, '').trim())
    .filter(Boolean)
    .filter((entry) => entry.toLowerCase() !== 'sans-serif' && entry.toLowerCase() !== 'serif' && entry.toLowerCase() !== 'monospace');
}

async function fetchRemoteCss(url: string) {
  const normalized = url.startsWith('//') ? `https:${url}` : url;
  const hash = crypto.createHash('md5').update(normalized).digest('hex');
  const cachePath = path.join(BRAND_FONT_CACHE_DIR, `${hash}.css`);
  if (await fs.pathExists(cachePath)) {
    return fs.readFile(cachePath, 'utf8');
  }
  try {
    const response = await fetch(normalized);
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    const css = await response.text();
    await fs.ensureDir(BRAND_FONT_CACHE_DIR);
    await fs.writeFile(cachePath, css, 'utf8');
    return css;
  } catch (error) {
    void error;
    return null;
  }
}

function resolveHref(baseDir: string, href: string) {
  const lower = href.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//')) {
    return href;
  }
  if (lower.startsWith('data:')) return null;
  const cleaned = href.split('?')[0].split('#')[0];
  if (!cleaned) return null;
  if (path.isAbsolute(cleaned)) {
    return path.join(baseDir, cleaned);
  }
  return path.join(baseDir, cleaned);
}

function collectFontsFromCss(css: string, set: Set<string>) {
  let match: RegExpExecArray | null;
  while ((match = FONT_FAMILY_DECL_RE.exec(css))) {
    normalizeFontName(match[1] || '').forEach((font) => set.add(font));
  }
  while ((match = FONT_FACE_RE.exec(css))) {
    normalizeFontName(match[1] || '').forEach((font) => set.add(font));
  }
}

async function processCssImports(css: string, baseDir: string, seen: Set<string>, set: Set<string>) {
  if (!css) return;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(css))) {
    const rawUrl = match[1]?.replace(/['"]/g, '').trim();
    if (!rawUrl) continue;
    let cssContent: string | null = null;
    const resolved = resolveHref(baseDir, rawUrl);
    if (!resolved) continue;
    if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('//')) {
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      cssContent = await fetchRemoteCss(resolved);
    } else {
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      if (await fs.pathExists(resolved)) {
        cssContent = await fs.readFile(resolved, 'utf8');
      }
    }
    if (cssContent) {
      collectFontsFromCss(cssContent, set);
      await processCssImports(cssContent, path.dirname(resolved), seen, set);
    }
  }
}

export async function detectFonts(htmlPath: string, html: string) {
  const dir = path.dirname(htmlPath);
  const fontFamilies = new Set<string>();
  const seenCss = new Set<string>();

  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = INLINE_STYLE_RE.exec(html))) {
    const css = inlineMatch[1];
    collectFontsFromCss(css, fontFamilies);
    await processCssImports(css, dir, seenCss, fontFamilies);
  }

  const cssLinks = [...html.matchAll(CSS_LINK_RE)];
  for (const [, href] of cssLinks) {
    const resolved = resolveHref(dir, href);
    if (!resolved || seenCss.has(resolved)) continue;
    seenCss.add(resolved);
    let css: string | null = null;
    if (resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('//')) {
      css = await fetchRemoteCss(resolved);
    } else if (await fs.pathExists(resolved)) {
      css = await fs.readFile(resolved, 'utf8');
    }
    if (css) {
      collectFontsFromCss(css, fontFamilies);
      await processCssImports(css, path.dirname(resolved), seenCss, fontFamilies);
    }
  }

  return [...fontFamilies];
}

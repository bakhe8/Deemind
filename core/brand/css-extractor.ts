import fs from 'fs-extra';
import path from 'path';

const LINK_RE = /<link[^>]+rel=["']?stylesheet["']?[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
const INLINE_STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const VAR_RE = /(--[\w-]+)\s*:\s*([^;]+);/g;

function resolveLocalHref(htmlDir: string, href: string) {
  if (!href) return null;
  const lower = href.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//') || lower.startsWith('data:')) {
    return null;
  }
  const cleaned = href.split('?')[0].split('#')[0];
  if (!cleaned) return null;
  if (path.isAbsolute(cleaned)) {
    return path.join(htmlDir, cleaned);
  }
  return path.join(htmlDir, cleaned);
}

function collectVars(css: string, colors: Record<string, string>) {
  if (!css) return;
  let match: RegExpExecArray | null;
  while ((match = VAR_RE.exec(css))) {
    const key = match[1]?.trim();
    const value = match[2]?.trim();
    if (key && value) {
      colors[key] = value;
    }
  }
}

export async function extractCSSVariables(htmlPath: string, html: string) {
  const dir = path.dirname(htmlPath);
  const colors: Record<string, string> = {};

  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = INLINE_STYLE_RE.exec(html))) {
    collectVars(inlineMatch[1], colors);
  }

  const cssLinks = [...html.matchAll(LINK_RE)];
  for (const [, href] of cssLinks) {
    const cssPath = resolveLocalHref(dir, href);
    if (!cssPath) continue;
    if (await fs.pathExists(cssPath)) {
      const css = await fs.readFile(cssPath, 'utf8');
      collectVars(css, colors);
    }
  }

  return colors;
}

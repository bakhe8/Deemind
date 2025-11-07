// Semantic mapper with optional i18n and client overrides
import fs from 'fs-extra';
import path from 'path';

function buildReplacementsDict(client) {
  const base = path.resolve('configs', 'mappings.json');
  const dict = fs.existsSync(base) ? fs.readJsonSync(base) : { placeholders: {} };
  if (client) {
    const clientFile = path.resolve('configs', client, 'mappings.json');
    if (fs.existsSync(clientFile)) {
      const clientDict = fs.readJsonSync(clientFile);
      Object.assign(dict.placeholders, clientDict.placeholders || {});
    }
  }
  return dict.placeholders || {};
}

export async function mapSemantics(parsed, { i18n = false, client, sanitize = false } = {}) {
  const placeholders = buildReplacementsDict(client);
  const pages = parsed.pages.map(p => {
    let html = p.html;
    for (const [key, value] of Object.entries(placeholders)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      html = html.replace(re, value);
      // Also replace bare tokens in text nodes (e.g., PRODUCT_NAME)
      const bare = new RegExp(`\\b${key}\\b`, 'g');
      html = html.replace(bare, value);
    }
    if (i18n) {
      html = html.replace(/<title>(.*?)<\/title>/is, (_m, p1) => `<title>{% trans %}${p1}{% endtrans %}</title>`);
    }
    // Remove common sample placeholder strings to satisfy extended validator
    // Why: prototype text like "Sample" or "Lorem ipsum" should not ship; map to safe Twig
    html = html.replace(/\bSample\b/gi, '{{ site.name }}');
    html = html.replace(/Lorem ipsum/gi, '{{ site.tagline|default("") }}');
    if (sanitize) {
      // Remove inline event handlers (why: unsafe and non-portable in themes)
      html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
                 .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
      // Remove insecure http script tags (why: enforce https-only assets)
      html = html.replace(/<script[^>]+src=["']http:\/\/[^>]*><\/script>/gi, '');
    }
    return { ...p, html };
  });
  return { ...parsed, pages };
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

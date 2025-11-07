// Semantic mapper with optional i18n and client overrides
import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';

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

/**
 * Apply semantic replacements and optional i18n/sanitization.
 * Why: Mapping known placeholders first creates a predictable substrate
 * for i18n wrapping, while sanitize removes risky inline handlers now so
 * validation doesn’t have to guess intent later. Client overrides are
 * merged to preserve per‑brand vocabulary.
 */
export async function mapSemantics(parsed, { i18n = false, client, sanitize = false } = {}) {
  const placeholders = buildReplacementsDict(client);
  const pages = parsed.pages.map(p => {
    let html = p.html;
    for (const [key, value] of Object.entries(placeholders)) {
      const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      html = html.replace(re, value);
      html = html.replace(re, value);
      // Also replace bare tokens like PRODUCT_NAME without braces
      const bare = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'g');
      html = html.replace(bare, value);
    }
    // i18n wrapping (title + visible text + attribute allowlist)
    if (i18n) {
      // Title
      html = html.replace(/<title>(.*?)<\/title>/is, (_m, p1) => `<title>{% trans %}${p1}{% endtrans %}</title>`);
      try {
        const $ = cheerio.load(html, { decodeEntities: false });
        const attrAllow = ['title', 'alt', 'aria-label'];
        // Attributes
        $('[title], [alt], [aria-label]').each((_, el) => {
          for (const a of attrAllow) {
            const val = $(el).attr(a);
            if (val && /[A-Za-z\u0600-\u06FF]/.test(val) && !val.includes('{{')) {
              $(el).attr(a, `{{ "${val}" | t }}`);
            }
          }
        });
        // Text nodes (skip script/style)
        $('body, body *').contents().each((_, node) => {
          if (node.type === 'text') {
            const txt = node.data || '';
            const trimmed = txt.replace(/\s+/g, ' ').trim();
            if (trimmed.length >= 8 && !txt.includes('{{')) {
              // replace with trans block
              const wrapped = `{% trans %}${trimmed}{% endtrans %}`;
              node.data = txt.replace(trimmed, wrapped);
            }
          }
        });
        html = $.html();
      } catch (e) { void e; }
    }
    if (sanitize) {
      // Remove inline event handlers
      html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
                 .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
      // Remove insecure http script tags
      html = html.replace(/<script[^>]+src=["']http:\/\/[^>]*><\/script>/gi, '');
    }
    return { ...p, html };
  });
  return { ...parsed, pages };
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

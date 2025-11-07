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
    }
    if (i18n) {
      html = html.replace(/<title>(.*?)<\/title>/is, (_m, p1) => `<title>{% trans %}${p1}{% endtrans %}</title>`);
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

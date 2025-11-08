#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { I18N_TAGS as TAGS, I18N_ATTRS as ATTRS } from '../configs/constants.js';

function wrapTextBlocks(twig) {
  let out = twig;
  const isTranslatable = (txt) => {
    const s = String(txt).trim();
    if (!s) return false;
    // skip pure numbers/punctuation/entities
    if (/^(&[a-zA-Z0-9#]+;|[\p{N}\p{P}\s])+$/u.test(s)) return false;
    try { return /\p{L}/u.test(s); } catch { return /[A-Za-z\u0600-\u06FF]/.test(s); }
  };
  // 1) Single-line text nodes (fast path)
  for (const tag of TAGS) {
    const re = new RegExp(`<${tag}([^>]*)>([^<{}%\n\r]+)</${tag}>`, 'g');
    out = out.replace(re, (m, attrs, text) => {
      const clean = (text || '').trim();
      if (!clean || !isTranslatable(clean)) return m;
      return `<${tag}${attrs}>{% trans %}${clean}{% endtrans %}</${tag}>`;
    });
  }
  // 2) Multiline plain text nodes (no child tags or twig tokens)
  for (const tag of TAGS) {
    const reMl = new RegExp(`<${tag}([^>]*)>([\s\S]*?)</${tag}>`, 'g');
    out = out.replace(reMl, (m, attrs, inner) => {
      const hasTwig = /{[%{]/.test(inner);
      const hasTags = /<\/?[a-zA-Z]/.test(inner);
      const clean = (inner || '').trim();
      if (!clean || hasTwig || hasTags || !isTranslatable(clean)) return m;
      const normalized = clean.replace(/\s+/g, ' ');
      return `<${tag}${attrs}>{% trans %}${normalized}{% endtrans %}</${tag}>`;
    });
  }
  // 2b) Nested fragments: within allowed tags, wrap bare text segments between child elements
  for (const tag of TAGS) {
    const reNest = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'g');
    out = out.replace(reNest, (m, open, inner, close) => {
      // Replace occurrences of >text< that are not already twig and not whitespace only
      const replaced = inner.replace(/>([^<>{}%\n\r][^<>{}%]+)</g, (mm, txt) => {
        const clean = String(txt).trim();
        if (!clean || !isTranslatable(clean)) return mm;
        return `>{% trans %}${clean}{% endtrans %}<`;
      });
      return open + replaced + close;
    });
  }
  // 2c) Arabic/RTL-sensitive wrapping: wrap any visible text containing Arabic codepoints
  const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  out = out.replace(/>([^<>{}%]+)</g, (m, txt) => {
    const clean = String(txt).trim();
    if (!clean) return m;
    if (!ARABIC.test(clean) || !isTranslatable(clean)) return m;
    return `>{% trans %}${clean}{% endtrans %}<`;
  });
  // 3) Wrap attributes (multiple occurrences)
  out = out.replace(/<([a-zA-Z0-9_-]+)([^>]*?)>/g, (m, tag, attrs) => {
    let newAttrs = attrs;
    let changed = false;
    for (const a of ATTRS) {
      // Match either "value" or 'value' forms without using numeric backrefs (avoid template-string escapes)
      const rx = new RegExp(`(\\n|\\r|\\s)${a}=(\\"([^\\"]+?)\\"|'([^']+?)')`, 'g');
      newAttrs = newAttrs.replace(rx, (_match, ws, _full, dval, sval) => {
        const val = dval || sval;
        changed = true;
        const safe = String(val).replace(/'/g, "\\'");
        return `${ws}${a}="{{ '${safe}' | t }}"`;
      });
    }
    return changed ? `<${tag}${newAttrs}>` : m;
  });
  return out;
}

async function runFix(theme) {
  const outRoot = path.join(process.cwd(), 'output', theme);
  const targets = ['layout','pages','partials']
    .map(d => path.join(outRoot, d))
    .filter(d => fs.existsSync(d));
  let count = 0;
  for (const dir of targets) {
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.twig'));
    for (const f of files) {
      const p = path.join(dir, f);
      const src = await fs.readFile(p, 'utf8');
      const wrapped = wrapTextBlocks(src);
      if (wrapped !== src) {
        await fs.writeFile(p, wrapped, 'utf8');
      }
      count++;
    }
  }
  return count;
}

async function main() {
  const theme = process.argv[2];
  if (!theme) { console.error('Usage: node tools/fix-i18n-output.js <theme>'); process.exit(1); }
  const n = await runFix(theme);
  console.log(`i18n fix pass completed on ${n} files across layout/pages/partials.`);
}

if (process.argv[1] && process.argv[1].endsWith('fix-i18n-output.js')) {
  main().catch(e => { console.error(e); process.exit(1); });
}

export { runFix };

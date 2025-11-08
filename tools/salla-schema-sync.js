#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

const REF_URL = 'https://developers.salla.sa/docs/theme-json-reference';

function tryParseJsonFromHtml(html) {
  // Try fenced code blocks first ```json ... ```
  const fence = Array.from(html.matchAll(/```json([\s\S]*?)```/gi)).map(m=>m[1]);
  for (const block of fence) {
    try { const obj = JSON.parse(block.trim()); if (obj && typeof obj==='object') return obj; } catch {}
  }
  // Attempt to find a JSON block in code/pre tags or fenced blocks
  const blocks = [];
  const code = html.match(/<code[^>]*>[\s\S]*?<\/code>/gi) || [];
  const pre = html.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
  blocks.push(...code, ...pre);
  const texts = blocks.map(b => b.replace(/<[^>]+>/g, ''));
  for (const t of texts) {
    const idx = t.indexOf('{');
    if (idx >= 0) {
      const tail = t.slice(idx);
      try {
        const obj = JSON.parse(tail);
        if (obj && typeof obj === 'object') return obj;
      } catch {}
    }
  }
  // As a last resort, try to extract JSON-looking substring between first { and last }
  const all = html.replace(/<[^>]+>/g, '');
  const i = all.indexOf('{');
  const j = all.lastIndexOf('}');
  if (i >= 0 && j > i) {
    const sub = all.slice(i, j + 1);
    try { return JSON.parse(sub); } catch {}
  }
  return null;
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  const docsPath = path.join(process.cwd(), 'docs', 'salla-reference.md');
  const schemaPath = path.join(process.cwd(), 'configs', 'salla-schema.json');
  await fs.ensureDir(reportsDir);

  let existing = {};
  try { existing = await fs.readJson(schemaPath); } catch {}
  let next = null;
  try {
    const res = await fetch(REF_URL, { headers: { 'User-Agent': 'Deemind/1.0' } });
    if (res.ok) {
      const html = await res.text();
      next = tryParseJsonFromHtml(html);
    }
  } catch {}

  const lines = [];
  lines.push('# Salla Schema Sync');
  lines.push(`Source: ${REF_URL}`);

  if (next && Object.keys(next).length) {
    // naive diff size
    const changed = JSON.stringify(next) !== JSON.stringify(existing);
    if (changed) {
      await fs.writeJson(schemaPath, next, { spaces: 2 });
      lines.push('Status: updated');
    } else {
      lines.push('Status: no change');
    }
  } else {
    lines.push('Status: no schema found in page (kept existing)');
  }
  await fs.writeFile(path.join(reportsDir, 'salla-schema-sync.md'), lines.join('\n'));

  // Update docs/salla-reference.md last sync stamp
  const stamp = `\nLast schema sync: ${new Date().toISOString()}\n`;
  try {
    const doc = await fs.readFile(docsPath, 'utf8');
    if (!doc.includes('Last schema sync:')) {
      await fs.appendFile(docsPath, stamp);
    } else {
      const updated = doc.replace(/Last schema sync:.*\n?/g, stamp);
      await fs.writeFile(docsPath, updated);
    }
  } catch {
    await fs.ensureDir(path.dirname(docsPath));
    await fs.writeFile(docsPath, `# Salla Reference\n${stamp}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

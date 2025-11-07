// Extract inline JS from HTML safely without executing
// Returns mapping per page: [{ index, bytes, hint }]

export function extractInlineJs(pages) {
  const result = {};
  for (const p of pages) {
    const list = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let i = 0; let m;
    while ((m = re.exec(p.html))) {
      const code = m[1] || '';
      const hint = /addEventListener|\$\(|DOMContentLoaded/.test(code) ? 'dom-ready' : 'generic';
      list.push({ index: i++, bytes: Buffer.byteLength(code, 'utf8'), hint, code });
    }
    result[p.rel] = list;
  }
  return result;
}


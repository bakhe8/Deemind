#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';

function nowIso() { return new Date().toISOString(); }

async function readTokens() {
  const p = path.join(process.cwd(), 'configs', 'design-tokens.json');
  if (await fs.pathExists(p)) return fs.readJson(p);
  return {
    "--color-primary": "#0046FF",
    "--color-secondary": "#11224E",
    "--font-base": "Inter, Tajawal, sans-serif",
    "--spacing-sm": "8px",
    "--spacing-md": "16px",
    "--spacing-lg": "24px",
    "--radius-md": "8px",
    "--transition-md": "200ms ease-in-out"
  };
}

function tokensToCss(tokens) {
  const vars = Object.entries(tokens).map(([k,v]) => `  ${k}: ${v};`).join('\n');
  return `:root{\n${vars}\n}\n`;
}

function baseCss() {
  return `/* Mockup Tokens & Base Styles */\nbody{font-family:var(--font-base);margin:0;color:var(--color-secondary)}\n.container{max-width:1200px;margin:auto;padding:var(--spacing-md)}\n.navbar{display:flex;align-items:center;justify-content:space-between;gap:var(--spacing-md);padding:var(--spacing-md)}\n.brand{color:var(--color-secondary);text-decoration:none;font-weight:600}\n.hero{display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-lg);align-items:center;padding:var(--spacing-lg);background:linear-gradient(180deg,#fff,#eef);border-radius:var(--radius-md)}\n.hero .cta{background:var(--color-primary);color:#fff;border:none;padding:12px 20px;border-radius:var(--radius-md);cursor:pointer;transition:opacity var(--transition-md)}\n.hero .cta:hover{opacity:.9}\n.grid-4{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--spacing-md)}\n.card{border:1px solid rgba(0,0,0,.08);border-radius:var(--radius-md);padding:var(--spacing-md)}\n.banner{margin:var(--spacing-lg) 0;padding:var(--spacing-lg);background:var(--color-primary);color:#fff;border-radius:var(--radius-md);text-align:center}\n.footer{padding:var(--spacing-md);text-align:center;color:#667}\n:dir(rtl) .navbar{direction:rtl}\n:dir(ltr) .navbar{direction:ltr}\n`;
}

function previewHtml(theme) {
  return `<!doctype html>\n<html lang="en" dir="ltr">\n<head>\n<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width,initial-scale=1"/>\n<title>${theme} — Mockup</title>\n<link rel="stylesheet" href="./tokens.css"/>\n<link rel="stylesheet" href="./preview.css"/>\n</head>\n<body>\n  <div class="navbar container">\n    <a class="brand" href="#">${theme}</a>\n    <div class="actions">\n      <span>Home</span><span>Shop</span><span>Contact</span>\n    </div>\n  </div>\n  <main class="container">\n    <section class="hero">\n      <div>\n        <h1>Modern, clean, and fast</h1>\n        <p>Built on Salla components and design tokens.</p>\n        <button class="cta">Get Started</button>\n      </div>\n      <div style="background:#ddd;height:220px;border-radius:var(--radius-md)"></div>\n    </section>\n    <section class="grid-4" style="margin-top:var(--spacing-lg)">\n      <div class="card">Product #1</div>\n      <div class="card">Product #2</div>\n      <div class="card">Product #3</div>\n      <div class="card">Product #4</div>\n    </section>\n    <section class="banner">Promotional banner with accent color</section>\n  </main>\n  <footer class="footer">\n    <small>© ${new Date().getFullYear()} ${theme}</small>\n  </footer>\n</body>\n</html>`;
}

function componentHtml(name) {
  switch (name) {
    case 'navbar':
      return `<nav class="navbar"><a class="brand" href="#">Brand</a><div>Home · Shop · Cart</div></nav>`;
    case 'hero':
      return `<section class="hero"><div><h1>Headline</h1><p>Subhead</p><button class="cta">Call to Action</button></div><div style="background:#ddd;height:220px;border-radius:var(--radius-md)"></div></section>`;
    case 'product-card':
      return `<article class="card">Product Card</article>`;
    case 'footer':
      return `<footer class="footer"><small>© Brand</small></footer>`;
    default:
      return `<div class="card">${name}</div>`;
  }
}

async function writeConcept(dir, theme, tokens) {
  const lines = [];
  lines.push(`# Mockup Concept — ${theme}`);
  lines.push('');
  lines.push('## Tokens');
  for (const [k,v] of Object.entries(tokens)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## Structure');
  lines.push('- Navbar (responsive)');
  lines.push('- Hero banner (image + text + CTA)');
  lines.push('- Featured grid (4 products)');
  lines.push('- Promotional banner');
  lines.push('- Footer (links/social)');
  lines.push('');
  lines.push('## Notes');
  lines.push('- LTR/RTL aware via :dir()');
  lines.push('- Uses Salla tokens naming');
  await fs.writeFile(path.join(dir, 'concept.md'), lines.join('\n'));
}

async function generate(theme) {
  const tokens = await readTokens();
  const root = path.join(process.cwd(), 'mockups', theme);
  const compDir = path.join(root, 'components');
  await fs.ensureDir(compDir);
  await fs.writeFile(path.join(root, 'tokens.css'), tokensToCss(tokens));
  await fs.writeFile(path.join(root, 'preview.css'), baseCss());
  await fs.writeFile(path.join(root, 'preview.html'), previewHtml(theme));
  await fs.writeFile(path.join(compDir, 'navbar.html'), componentHtml('navbar'));
  await fs.writeFile(path.join(compDir, 'hero.html'), componentHtml('hero'));
  await fs.writeFile(path.join(compDir, 'product-card.html'), componentHtml('product-card'));
  await fs.writeFile(path.join(compDir, 'footer.html'), componentHtml('footer'));
  await writeConcept(root, theme, tokens);

  // Report
  const rep = [];
  rep.push(`# Mockup Report — ${theme}`);
  rep.push(`- Generated: ${nowIso()}`);
  rep.push('- Files:');
  rep.push(`  - mockups/${theme}/preview.html`);
  rep.push(`  - mockups/${theme}/tokens.css`);
  rep.push(`  - mockups/${theme}/preview.css`);
  rep.push(`  - mockups/${theme}/components/`);
  await fs.ensureDir(path.join(process.cwd(), 'reports'));
  await fs.writeFile(path.join(process.cwd(), 'reports', `mockup-${theme}.md`), rep.join('\n'));

  console.log(`Acknowledged: Generating mock-up for new Salla theme ${theme}.`);
  console.log(`Mock-up ready at mockups/${theme}/ — Owner confirmation required before theme synthesis.`);
}

async function main() {
  const theme = process.argv[2];
  if (!theme) {
    console.error('Usage: node tools/mockup-generator.js <theme-name>');
    process.exit(1);
  }
  await generate(theme);
}

main().catch(e => { console.error(e); process.exit(1); });


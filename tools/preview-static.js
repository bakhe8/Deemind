#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob';

const DEFAULT_THEME = 'demo';
const STORE_DATA_ROOT = path.resolve('mockups', 'store');
const STATIC_PAGES = [
  'index',
  'landing-page',
  'product/index',
  'product/single',
  'cart',
  'brands/index',
  'blog/index',
  'customer/profile',
  'customer/orders/index',
  'customer/orders/single'
];

function loadJson(themeRoot, fallbackRoot, filename, fallbackValue) {
  const themeFile = path.join(themeRoot, filename);
  const fallbackFile = path.join(fallbackRoot, filename);
  if (fs.existsSync(themeFile)) return fs.readJsonSync(themeFile);
  if (fs.existsSync(fallbackFile)) return fs.readJsonSync(fallbackFile);
  return fallbackValue;
}

function loadStoreData(theme) {
  const themeRoot = path.join(STORE_DATA_ROOT, theme);
  const fallbackRoot = path.join(STORE_DATA_ROOT, DEFAULT_THEME);
  return {
    store: loadJson(themeRoot, fallbackRoot, 'store.json', {}),
    navigation: loadJson(themeRoot, fallbackRoot, 'navigation.json', []),
    hero: loadJson(themeRoot, fallbackRoot, 'hero.json', {}),
    inventory: loadJson(themeRoot, fallbackRoot, 'inventory.json', []),
    cart: loadJson(themeRoot, fallbackRoot, 'cart.json', { items: [], summary: {} }),
    brands: loadJson(themeRoot, fallbackRoot, 'brands.json', []),
    blog: loadJson(themeRoot, fallbackRoot, 'blog.json', []),
    orders: loadJson(themeRoot, fallbackRoot, 'orders.json', [])
  };
}

function collectThemeSlugs(theme) {
  const pagesRoot = path.resolve('output', theme, 'pages');
  if (!fs.existsSync(pagesRoot)) return [];
  const patterns = ['**/*.html', '**/*.twig'];
  const slugs = new Set();
  for (const pattern of patterns) {
    const files = globSync(pattern, { cwd: pagesRoot, nodir: true });
    files.forEach((file) => {
      const clean = file.replace(/\\/g, '/').replace(/\.(html|twig)$/i, '');
      if (!clean.startsWith('partials/')) {
        slugs.add(clean);
      }
    });
  }
  return Array.from(slugs);
}

function layoutShell({ title, body, accent, primary, navigation }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont;
        color: #0f172a;
        background: #f6f7fb;
        --primary: ${primary || '#111827'};
        --accent: ${accent || '#5bd5c4'};
      }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0 0 4rem; }
      .preview-shell { max-width: 1240px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
      header { display:flex; justify-content:space-between; align-items:center; padding:1rem 0 2.5rem; gap:1rem; flex-wrap:wrap; }
      header strong { font-size:1.1rem; letter-spacing:0.08em; flex:1 1 auto; }
      header nav { display:flex; gap:0.9rem; font-size:0.9rem; color:#475569; flex-wrap:wrap; align-items:center; }
      header nav a { text-decoration:none; color:inherit; font-weight:600; padding:0.3rem 0.6rem; border-radius:0.5rem; transition:background .2s; display:flex; align-items:center; gap:0.35rem; }
      header nav a:hover { background:rgba(15,23,42,0.08); }
      .cart-count { display:inline-flex; min-width:1.5rem; justify-content:center; align-items:center; font-size:0.75rem; color:white; background:var(--primary); border-radius:999px; padding:0.05rem 0.45rem; }
      .eyebrow { text-transform:uppercase; letter-spacing:0.2em; font-size:0.75rem; color:#94a3b8; margin-bottom:0.5rem; display:block; }
      h1 { font-size:2.4rem; margin:0 0 0.75rem; font-weight:700; }
      h2 { font-size:1.8rem; margin:0 0 0.5rem; }
      .muted { color:#64748b; line-height:1.6; }
      .hero { padding:2rem 0 3rem; }
      .hero-actions { display:flex; gap:1rem; margin-top:1.5rem; flex-wrap:wrap; }
      .btn { border-radius:999px; padding:0.85rem 1.6rem; border:1px solid transparent; font-weight:600; cursor:pointer; transition:all .2s ease; }
      .btn.primary { background:var(--primary); color:white; }
      .btn.primary:hover { opacity:.9; }
      .btn.ghost { border-color:#cbd5f5; color:var(--primary); background:white; }
      .btn.full { width:100%; text-align:center; }
      .grid { display:grid; gap:1.5rem; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); margin:1.5rem 0 0; }
      .card { background:white; border:1px solid #e2e8f0; border-radius:1.2rem; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08); position:relative; }
      .card-image { background:linear-gradient(135deg,#e2e8f0,#f8fafc); height:220px; }
      .card-image img { width:100%; height:100%; object-fit:cover; display:block; }
      .card-body { padding:1.25rem; }
      .card-badge { position:absolute; margin:1rem; background:rgba(15,23,42,0.85); color:white; padding:0.2rem 0.75rem; border-radius:999px; font-size:0.7rem; letter-spacing:0.1em; text-transform:uppercase; }
      .stars { color:#fbbf24; font-size:0.85rem; display:flex; gap:0.15rem; margin:0.4rem 0 0.6rem; }
      .split { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1.25rem; margin-top:1.5rem; }
      .testimonial, .stat-block { background:white; border-radius:1.5rem; padding:1.5rem; border:1px solid #e2e8f0; box-shadow:0 6px 20px rgba(15,23,42,0.06); }
      .stat-block h3 { margin:0; font-size:2.2rem; }
      .filters { display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap; }
      .chip { border-radius:999px; border:1px solid #cbd5f5; padding:0.45rem 1rem; background:white; color:#0f172a; cursor:pointer; font-size:0.85rem; }
      .chip.active { background:var(--primary); color:white; border-color:var(--primary); }
      .product-layout { display:grid; gap:2rem; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); align-items:center; margin-top:1rem; }
      .gallery { background:linear-gradient(135deg,#e2e8f0,#f8fafc); border-radius:1.5rem; height:480px; position:relative; overflow:hidden; }
      .gallery img { width:100%; height:100%; object-fit:cover; opacity:.85; }
      .cart { background:white; border-radius:1.5rem; padding:2rem; border:1px solid #e2e8f0; box-shadow:0 10px 30px rgba(15,23,42,0.05); max-width:520px; margin:2rem auto; }
      .cart-row { display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0; border-bottom:1px solid #e2e8f0; }
      .cart-total { display:flex; justify-content:space-between; align-items:center; font-size:1.1rem; margin:1.25rem 0; }
      .brands { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem; margin-top:1.5rem; }
      .brand-tile { background:white; border-radius:1rem; border:1px solid #e2e8f0; padding:1.25rem; box-shadow:0 8px 20px rgba(15,23,42,0.04); }
      .brand-tile p { margin:0.4rem 0 0; color:#475569; font-size:0.85rem; }
      .article-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1.5rem; }
      .article { background:white; border-radius:1.2rem; border:1px solid #e2e8f0; box-shadow:0 8px 24px rgba(15,23,42,0.05); overflow:hidden; }
      .article img { width:100%; height:180px; object-fit:cover; }
      .article .body { padding:1.25rem; }
    </style>
  </head>
  <body>
    <div class="preview-shell">
      <header>
        <strong>Deemind Preview</strong>
        <nav>
          ${(navigation || [])
            .map((item) => {
              const isCart = item.label?.toLowerCase() === 'cart';
              const badge = isCart ? '<span class="cart-count" data-cart-count>0</span>' : '';
              return `<a href="${item.href}">${item.label}${badge}</a>`;
            })
            .join('\n')}
        </nav>
      </header>
      ${body}
    </div>
  </body>
</html>`;
}

function starsTemplate(rating) {
  const rounded = Math.round(rating);
  return Array.from({ length: 5 })
    .map((_, idx) => (idx < rounded ? '★' : '☆'))
    .join('');
}

function sectionLanding(data) {
  const hero = data.hero || {};
  const testimonials = hero.testimonials || [];
  const stats = hero.stats || [];
  return `
    <section class="hero">
      <span class="eyebrow">Twilight-ready Mock Store</span>
      <h1>${hero.headline}</h1>
      <p class="muted">${hero.subhead}</p>
      <div class="hero-actions">
        <a class="btn primary" href="/page/product/index">${hero.cta_primary || hero.ctaPrimary || 'Browse Catalog'}</a>
        <button class="btn ghost" data-cart-add="${(data.inventory?.[0]?.id) || 1}">
          ${hero.cta_secondary || hero.ctaSecondary || 'Quick Add'}
        </button>
      </div>
      <div class="split">
        ${testimonials
          .map(
            (t) => `
            <div class="testimonial">
              <p>${t.quote}</p>
              <span>${t.author}</span>
            </div>`,
          )
          .join('\n')}
      </div>
    </section>
    <section class="grid">
      ${data.products
        .slice(0, 3)
        .map(
          (p) => `
        <article class="card">
          <div class="card-badge">${p.badge}</div>
          <div class="card-image"><img src="${p.image}" alt="${p.title}" loading="lazy" /></div>
          <div class="card-body">
            <h3>${p.title}</h3>
            <div class="stars">${starsTemplate(p.rating)}</div>
            <p>${p.price}</p>
            <button class="btn ghost" data-cart-add="${p.id}">Quick add</button>
          </div>
        </article>`,
        )
        .join('\n')}
    </section>
    <section class="split">
      ${stats
        .map(
          (stat) => `
        <div class="stat-block">
          <span class="eyebrow">${stat.label}</span>
          <h3>${stat.value}</h3>
          <p class="muted">Deemind baseline telemetry.</p>
        </div>`,
        )
        .join('\n')}
    </section>
  `;
}

function sectionCatalog(data) {
  const inventory = data.inventory || [];
  return `
    <section class="hero">
      <span class="eyebrow">Live Catalog</span>
      <h1>Featured Products</h1>
      <p class="muted">Mock data seeded from \`mockups/demo-store.json\` following Salla’s product schema.</p>
      <div class="filters">
        <span>Sort by:</span>
        <a class="chip" href="/page/product/index#popular">Popularity</a>
        <span class="chip active">New arrivals</span>
        <a class="chip" href="/page/product/index#price">Price</a>
      </div>
    </section>
    <section class="grid">
      ${inventory
        .map(
          (p) => `
        <article class="card">
          <a href="/page/product/single" class="card-image"><img src="${p.image}" alt="${p.title}" loading="lazy" /></a>
          <div class="card-body">
            <span class="eyebrow">${p.badge}</span>
            <h3><a href="/page/product/single" style="text-decoration:none;color:inherit;">${p.title}</a></h3>
            <div class="stars">${starsTemplate(p.rating)}</div>
            <p>${p.price}</p>
            <button class="btn ghost" data-cart-add="${p.id}">Add to cart</button>
          </div>
        </article>`,
        )
        .join('\n')}
    </section>
  `;
}

function sectionProduct(data) {
  const heroProduct = (data.inventory && data.inventory[0]) || {};
  return `
    <section class="product-layout">
      <div class="gallery"><img src="${heroProduct.image}" alt="${heroProduct.title}" loading="lazy" /></div>
      <div class="details">
        <span class="eyebrow">Product detail</span>
        <h1>${heroProduct.title}</h1>
        <p class="muted">Rendered with Deemind preview engine. Replace this snapshot by dropping your HTML prototype into /input.</p>
        <p class="price">${heroProduct.price}</p>
        <button class="btn primary full" data-cart-add="${heroProduct.id || 1}">Add to cart</button>
        <button class="btn ghost full">Save to wishlist</button>
        <ul class="meta">
          <li>SKU · DM-0481</li>
          <li>Ships in 48h</li>
          <li>Free returns</li>
        </ul>
      </div>
    </section>
  `;
}

function sectionCart(data) {
  const items = (data.cart && data.cart.items) || [];
  const total = (data.cart && data.cart.summary && data.cart.summary.total) || '0 SAR';
  const shipping = (data.cart && data.cart.summary && data.cart.summary.shipping) || 'Free shipping';
  const rows = items
    .map(
      (item) => `
    <div class="cart-row">
      <div>
        <h3>${item.title}</h3>
        <p class="muted">Qty ${item.quantity} · ${item.price}</p>
      </div>
      <span>${item.price}</span>
    </div>`,
    )
    .join('\n');
  return `
    <section class="cart">
      <h1>Your bag</h1>
      ${rows}
      <div class="cart-total">
        <p>Total</p>
        <strong>${total}</strong>
      </div>
      <p class="muted">${shipping}</p>
      <a class="btn primary full" href="/page/thank-you">Checkout preview</a>
    </section>
  `;
}

function sectionBrands(data) {
  return `
    <section class="hero">
      <span class="eyebrow">Brand matrix</span>
      <h1>Partner Labels</h1>
      <p class="muted">Highlighting reusable sections sourced from Raed baseline and Deemind custom components.</p>
    </section>
    <div class="brands">
      ${data.brands
        .map(
          (brand) => `
        <div class="brand-tile">
          <strong>${brand.name}</strong>
          <p>${brand.tagline}</p>
        </div>`,
        )
        .join('\n')}
    </div>
  `;
}

function sectionBlog(data) {
  return `
    <section class="hero">
      <span class="eyebrow">Insights</span>
      <h1>Latest from the Lab</h1>
    </section>
    <section class="article-grid">
      ${data.blog
        .map(
          (article) => `
        <article class="article">
          <img src="${article.image}" alt="${article.title}" loading="lazy" />
          <div class="body">
            <span class="eyebrow">Product Update</span>
            <h3>${article.title}</h3>
            <p class="muted">${article.excerpt}</p>
            <button class="btn ghost">Read article</button>
          </div>
        </article>`,
        )
        .join('\n')}
    </section>
  `;
}

function sectionCustomerProfile(data) {
  const storeName = (data.store && data.store.name) || 'Deemind Customer';
  const domain = (data.store && data.store.domain) || 'atelier.deemind.local';
  return `
    <section class="hero">
      <span class="eyebrow">Customer portal</span>
      <h1>Welcome back, ${storeName}</h1>
      <p class="muted">Mock profile page showing addresses and wallet stats.</p>
    </section>
    <section class="grid">
      <article class="card">
        <div class="card-body">
          <span class="eyebrow">Contact</span>
          <h3>${domain}</h3>
          <p class="muted">Wallet enabled · Wishlist enabled</p>
        </div>
      </article>
      <article class="card">
        <div class="card-body">
          <span class="eyebrow">Address</span>
          <p class="muted">123 Deemind St · Riyadh, KSA</p>
        </div>
      </article>
    </section>
  `;
}

function sectionOrders(data) {
  const mockOrders = data.orders.length ? data.orders : [
    { id: 'INV-1024', status: 'Delivered', total: '429 SAR', date: '2025-11-02' },
    { id: 'INV-1025', status: 'Processing', total: '199 SAR', date: '2025-11-05' }
  ];
  return `
    <section class="hero">
      <span class="eyebrow">Order history</span>
      <h1>Your orders</h1>
    </section>
    <section class="grid">
      ${mockOrders
        .map(
          (order) => `
        <article class="card">
          <div class="card-body">
            <span class="eyebrow">${order.status}</span>
            <h3>${order.id}</h3>
            <p class="muted">${order.date}</p>
            <strong>${order.total}</strong>
          </div>
        </article>`,
        )
        .join('\n')}
    </section>
  `;
}

function renderBodyForSlug(slug, data) {
  switch (slug) {
    case 'product/index':
      return sectionCatalog(data);
    case 'product/single':
      return sectionProduct(data);
    case 'cart':
      return sectionCart(data);
    case 'brands/index':
      return sectionBrands(data);
    case 'blog/index':
      return sectionBlog(data);
    case 'customer/profile':
      return sectionCustomerProfile(data);
    case 'customer/orders/index':
      return sectionOrders(data);
    case 'customer/orders/single':
      return sectionOrders(data);
    case 'landing-page':
      return sectionLanding(data);
    default:
      return sectionPlaceholder(slug, data);
  }
}

function sectionPlaceholder(slug, data) {
  const title = slug
    .split('/')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' · ');
  return `
    <section class="hero">
      <span class="eyebrow">Auto Snapshot</span>
      <h1>${title}</h1>
      <p class="muted">This page was generated automatically from the theme's pages directory.</p>
      <div class="hero-actions">
        <a class="btn primary" href="/page/index">Back Home</a>
        ${(data.inventory?.[0]?.id)
          ? `<button class="btn ghost" data-cart-add="${data.inventory[0].id}">${data.hero?.cta_secondary || 'Quick Add'}</button>`
          : ''}
      </div>
    </section>
  `;
}

export async function generateStaticPreview(theme = DEFAULT_THEME, options = {}) {
  const data = loadStoreData(theme);
  const outDir = path.resolve('preview-static', theme, 'pages');
  const dynamicSlugs = collectThemeSlugs(theme);
  const slugs = Array.from(new Set([...STATIC_PAGES, ...dynamicSlugs]));
  await Promise.all(
    slugs.map(async (slug) => {
      const dest = path.join(outDir, `${slug}.html`);
      await fs.ensureDir(path.dirname(dest));
      await fs.writeFile(
        dest,
        layoutShell({
          title: `Deemind Preview · ${slug}`,
          body: renderBodyForSlug(slug, data),
          accent: data.store?.theme?.accent,
          primary: data.store?.theme?.primary,
          navigation: data.navigation,
        }),
        'utf8',
      );
    }),
  );
  if (!options.silent) {
    console.log(`✅ Preview demo snapshots written to preview-static/${theme}/pages`);
  }
  return outDir;
}

async function runFromCli() {
  const theme = process.argv[2] || DEFAULT_THEME;
  await generateStaticPreview(theme);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFromCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

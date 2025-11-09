import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import twig from 'twig';
import { globSync } from 'glob';
import net from 'net';

function parseArgs(rawArgs) {
  let theme = process.env.PREVIEW_THEME || 'demo';
  const options = {};
  rawArgs.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.replace(/^--/, '').split('=');
      options[key] = value === undefined ? true : value;
    } else if (!theme || theme === 'demo') {
      theme = arg;
    }
  });
  return { theme, options };
}

const { theme, options } = parseArgs(process.argv.slice(2));
const PORT = Number(options.port || process.env.PREVIEW_PORT || 3000);
const themeRoot = path.resolve('output', theme);
const pagesDir = path.join(themeRoot, 'pages');
const localesDir = path.join(themeRoot, 'locales');
const previewMetaPath = path.join(themeRoot, '.preview.json');
const layoutDir = path.join(themeRoot, 'layout');
const partialsDir = path.join(themeRoot, 'partials');
const staticPagesDir = path.resolve('preview-static', theme, 'pages');

if (!fs.existsSync(themeRoot)) {
  console.error(`❌ Theme "${theme}" not found at ${themeRoot}`);
  process.exit(1);
}

const previewMeta = fs.existsSync(previewMetaPath) ? fs.readJsonSync(previewMetaPath) : null;

const app = express();
const LR_PORT = Number(process.env.PREVIEW_LR_PORT || 45729);
const enableLiveReload = options.livereload !== 'false' && process.env.PREVIEW_LR !== 'false';
let liveServer = null;

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

if (enableLiveReload) {
  const available = await isPortFree(LR_PORT);
  if (!available) {
    console.warn(`⚠️ Live reload disabled: port ${LR_PORT} already in use.`);
  } else {
    try {
      liveServer = livereload.createServer({ delay: 200, port: LR_PORT });
      liveServer.server?.on('error', (err) => {
        console.warn(`⚠️ Live reload disabled (port ${LR_PORT} busy): ${err.message}`);
        try {
          liveServer?.close();
        } catch (closeErr) {
          if (process.env.DEBUG) console.warn(closeErr);
        }
        liveServer = null;
      });
      liveServer.watch(themeRoot);
      app.use(connectLivereload({ port: LR_PORT }));
    } catch (err) {
      console.warn(`⚠️ Live reload disabled: ${err.message}`);
    }
  }
} else {
  console.log('ℹ️ Live reload disabled via config.');
}

app.engine('twig', twig.__express);
app.set('view engine', 'twig');
app.set('views', themeRoot);

app.use('/assets', express.static(path.join(themeRoot, 'assets')));
app.use('/public', express.static(path.join(themeRoot, 'public')));
app.use('/static', express.static(themeRoot));

const noopFilter = (value) => value;
try {
  twig.extendFilter('trans', noopFilter);
  twig.extendFilter('t', noopFilter);
  twig.extendFunction('trans', noopFilter);
  twig.extendTag({
    type: 'hook',
    regex: /^hook\s+(.+)$/,
    next: [],
    open: false,
    compile(token) {
      const raw = (token.match && token.match[1]) ? token.match[1].trim() : '';
      token.output = raw.replace(/^['"]|['"]$/g, '');
      return token;
    },
    parse(token, context, chain) {
      const comment = token.output ? `<!-- hook:${token.output} -->` : '<!-- hook -->';
      return {
        chain,
        output: comment,
      };
    },
  });
} catch (err) {
  if (process.env.DEBUG) console.warn('Twig filter init failed', err);
}

function listPages(extension) {
  if (!fs.existsSync(pagesDir)) return [];
  return globFiles(`**/*.${extension}`).map((p) => p.replace(/\\/g, '/').replace(new RegExp(`\.${extension}$`), ''));
}

function globFiles(pattern) {
  if (!fs.existsSync(pagesDir)) return [];
  return globSync(pattern, { cwd: pagesDir, nodir: true });
}

function listStaticPages() {
  if (!fs.existsSync(staticPagesDir)) return [];
  return globSync('**/*.html', { cwd: staticPagesDir, nodir: true }).map((file) =>
    file.replace(/\\/g, '/').replace(/\.html$/, ''),
  );
}

function availablePages() {
  const res = new Set(listStaticPages());
  if (fs.existsSync(pagesDir)) {
    for (const ext of ['html', 'twig']) {
      globFiles(`**/*.${ext}`).forEach((file) => {
        res.add(file.replace(/\\/g, '/').replace(new RegExp(`\.${ext}$`), ''));
      });
    }
  }
  return Array.from(res);
}

function loadLocale(lang = 'en') {
  const localeFile = path.join(localesDir || '', `${lang}.json`);
  if (localeFile && fs.existsSync(localeFile)) {
    try {
      return fs.readJsonSync(localeFile) || {};
    } catch (err) {
      return {};
    }
  }
  return {};
}

function stripTransTags(source) {
  return source
    .replace(/\{%\s*trans\b[^%]*%\}/gi, '')
    .replace(/\{%\s*endtrans\s*%\}/gi, '');
}

function stripHookTags(source) {
  return source.replace(/\{%\s*hook\s+(['"])(.*?)\1[^%]*%\}/gi, '<!-- hook:$2 -->');
}

function stripComponentTags(source) {
  return source
    .replace(/\{%\s*component\s+(['"])(.*?)\1[^%]*%\}/gi, '<!-- component:$2 -->')
    .replace(/\{\{\s*component\((['"])(.*?)\1[^)]*\)\s*\}\}/gi, '<!-- component:$2 -->');
}

function stripIncludeDynamic(source) {
  return source.replace(/\{%\s*include_dynamic\s+(['"])(.*?)\1[^%]*%\}/gi, '<!-- include_dynamic:$2 -->');
}

function normalizeTemplateReference(ref, currentTwigPath) {
  const trimmed = ref.trim();
  if (!trimmed) return trimmed;
  const baseDir = path.dirname(currentTwigPath);
  const toPosix = (targetPath) => path.relative(baseDir, targetPath).replace(/\\/g, '/');
  if (trimmed.startsWith('layouts.')) {
    const name = trimmed.slice('layouts.'.length);
    return toPosix(path.join(layoutDir, `${name}.twig`));
  }
  if (trimmed.startsWith('layouts/')) {
    const name = trimmed.slice('layouts/'.length);
    return toPosix(path.join(layoutDir, name.endsWith('.twig') ? name : `${name}.twig`));
  }
  if (trimmed.startsWith('layout/')) {
    const name = trimmed.slice('layout/'.length);
    return toPosix(path.join(layoutDir, name.endsWith('.twig') ? name : `${name}.twig`));
  }
  if (trimmed.startsWith('partials.')) {
    const name = trimmed.slice('partials.'.length);
    return toPosix(path.join(partialsDir, `${name}.twig`));
  }
  if (trimmed.startsWith('partials/')) {
    const name = trimmed.slice('partials/'.length);
    return toPosix(path.join(partialsDir, name.endsWith('.twig') ? name : `${name}.twig`));
  }
  if (trimmed.startsWith('@')) {
    return trimmed; // namespaced include; leave as-is
  }
  return trimmed;
}

function rewriteTemplateRefs(source, currentTwigPath) {
  return source.replace(/\{%\s*(extends|include|embed)\s+(['"])([^'"]+)\2/gi, (match, keyword, quote, target) => {
    const normalized = normalizeTemplateReference(target, currentTwigPath);
    if (normalized === target) return match;
    return match.replace(target, normalized);
  });
}

function renderPage(slug, query) {
  if (!slug) return null;
  const cleanSlug = slug.replace(/^\/+/, '');
  const staticHtmlPath = path.join(staticPagesDir, `${cleanSlug}.html`);
  if (fs.existsSync(staticHtmlPath)) {
    try {
      return fs.readFileSync(staticHtmlPath, 'utf8');
    } catch (err) {
      console.warn(`⚠️ Failed to read static preview for ${cleanSlug}: ${err.message}`);
    }
  }
  const htmlPath = path.join(pagesDir, `${cleanSlug}.html`);
  if (fs.existsSync(htmlPath)) {
    try {
      const html = fs.readFileSync(htmlPath, 'utf8');
      return html.includes('<!DOCTYPE') ? html : `<!DOCTYPE html><html><body>${html}</body></html>`;
    } catch (err) {
      console.warn(`⚠️ Failed to read HTML stub for ${cleanSlug}: ${err.message}`);
    }
  }
  const twigPath = path.join(pagesDir, `${cleanSlug}.twig`);
  if (process.env.DEBUG_PREVIEW === '1') {
    console.log(`[preview] slug=${cleanSlug} twigPath=${twigPath} exists=${fs.existsSync(twigPath)}`);
  }
  if (fs.existsSync(twigPath)) {
    try {
      const lang = (query.lang || 'en').toLowerCase();
      const locale = loadLocale(lang);
      let source = fs.readFileSync(twigPath, 'utf8');
      source = rewriteTemplateRefs(
        stripIncludeDynamic(stripComponentTags(stripHookTags(stripTransTags(source)))),
        twigPath,
      );
      const template = twig.twig({ data: source, path: twigPath, async: false });
      return template.render({ locale, lang, query });
    } catch (err) {
      console.warn(`⚠️ Twig render failed for ${cleanSlug}: ${err.message}`);
      return `<pre>Preview render error for ${cleanSlug}: ${err.message}</pre>`;
    }
  }
  return null;
}

app.get('/', (req, res) => {
  const html = renderPage('index', req.query || {});
  if (html) return res.send(html);
  res.send('<p>No index page found. Visit <a href="/pages">/pages</a> to browse available routes.</p>');
});

app.get('/pages', (_req, res) => {
  const pages = availablePages();
  if (!pages.length) return res.send('<p>No pages found.</p>');
  res.send(`
    <h1>Preview Pages (${theme})</h1>
    <ul>${pages.map((p) => `<li><a href="/page/${p}">${p}</a></li>`).join('')}</ul>
  `);
});

app.get('/status', (_req, res) => {
  res.json({
    theme,
    port: PORT,
    pages: previewMeta?.pages || availablePages(),
    meta: previewMeta,
  });
});

app.get(/^\/page\/(.*)/, (req, res) => {
  const slug = req.params[0];
  const html = renderPage(slug, req.query || {});
  if (html) return res.send(html);
  res.status(404).send(`<p>Page "${slug}" not found.</p>`);
});

const watcher = chokidar.watch(themeRoot, { ignoreInitial: true });
watcher.on('all', (event, file) => {
  console.log(`🔁 [${event}] ${file}`);
  if (liveServer) {
    liveServer.refresh('/');
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Deemind Theme Preview running at http://localhost:${PORT}/`);
  console.log(`   Theme: ${theme}`);
  console.log('   Routes: /, /pages, /page/:slug?lang=ar');
});

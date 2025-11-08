import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import livereload from 'livereload';
import connectLivereload from 'connect-livereload';
import twig from 'twig';
import { globSync } from 'glob';

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

if (!fs.existsSync(themeRoot)) {
  console.error(`❌ Theme "${theme}" not found at ${themeRoot}`);
  process.exit(1);
}

const previewMeta = fs.existsSync(previewMetaPath) ? fs.readJsonSync(previewMetaPath) : null;

const app = express();
const LR_PORT = Number(process.env.PREVIEW_LR_PORT || 45729);
let liveServer = null;
try {
  liveServer = livereload.createServer({ delay: 200, port: LR_PORT });
  liveServer.watch(themeRoot);
  app.use(connectLivereload({ port: LR_PORT }));
} catch (err) {
  console.warn(`⚠️ Live reload disabled: ${err.message}`);
}

app.engine('twig', twig.__express);
app.set('view engine', 'twig');
app.set('views', themeRoot);

app.use('/assets', express.static(path.join(themeRoot, 'assets')));
app.use('/public', express.static(path.join(themeRoot, 'public')));
app.use('/static', express.static(themeRoot));

function listPages(extension) {
  if (!fs.existsSync(pagesDir)) return [];
  return globFiles(`**/*.${extension}`).map((p) => p.replace(/\\/g, '/').replace(new RegExp(`\.${extension}$`), ''));
}

function globFiles(pattern) {
  if (!fs.existsSync(pagesDir)) return [];
  return globSync(pattern, { cwd: pagesDir, nodir: true });
}

function availablePages() {
  if (!fs.existsSync(pagesDir)) return [];
  const res = new Set();
  for (const ext of ['html', 'twig']) {
    globFiles(`**/*.${ext}`).forEach((file) => {
      res.add(file.replace(/\\/g, '/').replace(new RegExp(`\.${ext}$`), ''));
    });
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

function renderPage(slug, query) {
  const htmlPath = path.join(pagesDir, `${slug}.html`);
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, 'utf8');
  }
  const twigPath = path.join(pagesDir, `${slug}.twig`);
  if (fs.existsSync(twigPath)) {
    const lang = (query.lang || 'en').toLowerCase();
    const locale = loadLocale(lang);
    const template = twig.twig({ path: twigPath, async: false });
    return template.render({ locale, lang, query });
  }
  return null;
}

app.get('/', (req, res) => {
  const html = renderPage('index', req.query || {});
  if (html) return res.send(html);
  res.send('<p>No index page found.</p>');
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

app.get('/page/:slug', (req, res) => {
  const html = renderPage(req.params.slug, req.query || {});
  if (html) return res.send(html);
  res.status(404).send(`<p>Page "${req.params.slug}" not found.</p>`);
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

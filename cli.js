#!/usr/bin/env node
/**
 * 🧠 Deemind — Intelligent Theming Engine
 * ---------------------------------------
 * Converts static HTML prototypes in /input/<themeName>
 * into validated, platform-ready Salla themes in /output/<themeName>.
 *
 * Run:
 *   npm run deemind:build demo
 */

import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

import { runHybridParser } from "./src/deemind-parser/hybrid-runner.js";
import { mapSemantics } from "./src/deemind-parser/semantic-mapper.js";
import { persistCanonicalModel, updateCanonicalModel } from "./src/deemind-parser/canonical-writer.js";
import { adaptToSalla } from "./src/adapter.js";
import { validateTheme, generateBuildManifest } from "./src/validator.js";
import { validateExtended } from "./tools/validator-extended.js";
import { prunePartials } from "./tools/partials-prune.js";
import { DEFAULT_THEME_META } from "./configs/constants.js";
import { loadBaselineSet, computeComponentUsage } from "./tools/baseline-compare.js";
import { ensureBaselineCompleteness } from "./tools/ensure-baseline-theme.js";
import { preparePreview } from "./tools/preview-prep.js";
import { runPreviewServer } from "./tools/preview-server.js";
import { generateStaticPreview } from "./tools/preview-static.js";
import { validateFile } from "./src/utils/schema-validator.js";
import { buildTwigDependencyGraph, writeTwigDependencyReport } from "./tools/twig-dependency-graph.js";
import { buildMockContext as buildDemoMockContext, writeMockContext as writeDemoMockContext } from "./tools/mock-layer/mock-data-builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "configs", "deemind.config.json");
const PREVIEW_DEFAULTS = {
  enabled: true,
  autoOpen: true,
  port: 3000,
  multiTheme: false,
  livereload: true,
};
const CORE_DIR = path.join(__dirname, "core");
const SALLA_THEME_SCHEMA = path.join(CORE_DIR, "salla", "schema.json");
const THEME_CONTRACT_SCHEMA = path.join(CORE_DIR, "contracts", "theme-contract.json");

/**
 * Orchestrates the full Deemind pipeline.
 * Why: Centralizes flags and stage order so we can keep a single
 * entrypoint that enforces stability first (parse → map → adapt → validate),
 * with guardrails like sanitize-by-default and a fail gate on critical
 * validator errors. This function intentionally keeps side‑effects (FS writes)
 * grouped per stage to simplify debugging and rollback.
 */
async function run() {
  console.log(chalk.cyanBright(`
██████╗ ███████╗███████╗███╗   ███╗██╗███╗   ██╗ ██████╗
██╔══██╗██╔════╝██╔════╝████╗ ████║██║████╗  ██║██╔═══██╗
██║  ██║█████╗  █████╗  ██╔████╔██║██║██╔██╗ ██║██║   ██║
██║  ██║██╔══╝  ██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║   ██║
██████╔╝███████╗███████╗██║ ╚═╝ ██║██║██║ ╚████║╚██████╔╝
╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝
                 🧠  Deemind  —  Theming Salla Edition
`));

  const themeName = process.argv[2];
  if (!themeName) {
    console.error(chalk.red("❌ Please specify a theme name.\n   Example: npm run deemind:build demo"));
    process.exit(1);
  }

  const inputRoot = path.join(__dirname, "input");
  const outputRoot = path.join(__dirname, "output");
  const inputPath = path.join(inputRoot, themeName);
  const outputPath = path.join(outputRoot, themeName);
  const manifestPath = path.join(outputPath, 'manifest.json');

  if (!fs.existsSync(inputPath)) {
    console.error(chalk.red(`❌ Input folder not found: ${inputPath}`));
    process.exit(1);
  }
  await fs.ensureDir(outputPath);

  const start = Date.now();
  console.log(chalk.gray(`\n📦 Starting Deemind build for: ${themeName}\n`));

  // Parse extra flags
  const args = process.argv.slice(3);
  const i18n = args.includes('--i18n');
  const lockUnchanged = args.includes('--lock-unchanged');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const clientFlag = args.find(a => a.startsWith('--client='));
  const client = clientFlag ? clientFlag.split('=')[1] : undefined;
  const prune = args.includes('--prune-partials');
  const partialize = args.includes('--partialize');
  const sanitize = args.includes('--sanitize');
  const autofix = args.includes('--autofix');
  const baselineFlag = args.find(a => a.startsWith('--baseline='));
  const baselineOverride = baselineFlag ? baselineFlag.split('=')[1] : undefined;
  const diffMode = args.includes('--diff');
  const autoApprove = args.includes('--auto');
  const baselineModeFlag = args.find(a => a.startsWith('--baseline-mode='));
  const baselineMode = baselineModeFlag ? baselineModeFlag.split('=')[1] : undefined;

  let runtimeConfig = {};
  try {
    if (await fs.pathExists(CONFIG_PATH)) {
      runtimeConfig = await fs.readJson(CONFIG_PATH);
    }
  } catch (err) {
    console.warn(chalk.yellow(`⚠️ Could not read ${CONFIG_PATH}: ${err.message}`));
  }
  const previewConfig = { ...PREVIEW_DEFAULTS, ...(runtimeConfig.preview || {}) };

  try {
    const t0 = Date.now();
    const inputChecksum = await hashInputDir(inputPath);

    console.log(chalk.yellow("🧾 Validating theme metadata..."));
    const themeMetaPath = path.join(inputPath, "theme.json");
    if (await fs.pathExists(themeMetaPath)) {
      await validateFile(SALLA_THEME_SCHEMA, themeMetaPath, "Salla theme schema");
      console.log(chalk.green("   ↳ theme.json passed Salla schema validation."));
    } else {
      console.log(chalk.gray("   ↳ theme.json not found; skipping Salla schema validation."));
    }

    console.log(chalk.yellow("🔍 Parsing HTML structure (hybrid)..."));
    const tParse0 = Date.now();
    const parsed = await runHybridParser(inputPath, { inputChecksum });
    const tParse1 = Date.now();
    console.log(chalk.green(`   ↳ completed in ${(tParse1 - tParse0) / 1000}s (confidence ${parsed.confidence})`));

    console.log(chalk.yellow("🗂️  Persisting canonical model..."));
    const canonicalStart = Date.now();
    const { filePath: canonicalPath } = await persistCanonicalModel(themeName, parsed);
    console.log(chalk.green(`   ↳ canonical saved to ${path.relative(process.cwd(), canonicalPath)} in ${(Date.now() - canonicalStart) / 1000}s`));
    await validateFile(THEME_CONTRACT_SCHEMA, canonicalPath, "ThemeContract canonical model");
    console.log(chalk.green("   ↳ canonical ThemeContract validation passed."));

    console.log(chalk.yellow("🧠 Mapping semantics and Twig variables..."));
    const tMap0 = Date.now();
    const mapped = await mapSemantics(parsed, { i18n, client, sanitize });
    const tMap1 = Date.now();
    if (mapped?.stats) {
      await updateCanonicalModel(themeName, (existing) => ({
        ...existing,
        parsed: {
          ...(existing.parsed || {}),
          semanticStats: mapped.stats,
        },
      }));
    }

    const lockDefault = process.env.CI && !lockUnchanged ? true : lockUnchanged;
    console.log(chalk.yellow("🪄 Adapting to Salla theme format..."));
    const tAdapt0 = Date.now();
    const adaptRes = await adaptToSalla(mapped, outputPath, { lockUnchanged: lockDefault, partialize, baseline: baselineOverride });
    const tAdapt1 = Date.now();

    console.log(chalk.yellow("🧰 Preparing mock data context..."));
    try {
      const mockContext = await buildDemoMockContext(themeName);
      await writeDemoMockContext(themeName, mockContext);
      console.log(chalk.green(`   ↳ mock context ready (preset: ${mockContext.meta?.demo || 'electronics'})`));
    } catch (mockErr) {
      console.warn(chalk.yellow(`   ↳ mock context skipped: ${mockErr instanceof Error ? mockErr.message : mockErr}`));
    }

    console.log(chalk.yellow('🕸️ Analyzing Twig dependency graph...'));
    try {
      const depInfo = await buildTwigDependencyGraph(outputPath);
      const depPaths = await writeTwigDependencyReport(themeName, depInfo);
      if (depInfo.cycles.length) {
        console.warn(chalk.red(`   ↳ ${depInfo.cycles.length} cycle(s) detected — see ${path.relative(process.cwd(), depPaths.mdPath)}`));
      } else {
        console.log(chalk.green(`   ↳ graph stored at ${path.relative(process.cwd(), depPaths.jsonPath)}`));
      }
    } catch (err) {
      console.warn(chalk.yellow(`   ↳ dependency graph skipped: ${err.message}`));
    }

    console.log(chalk.yellow("🧱 Ensuring baseline completeness..."));
    const baselineRes = await ensureBaselineCompleteness(outputPath, {
      baselineName: baselineOverride,
      manifestPath: path.join(outputPath, 'reports', 'baseline-summary.json'),
      themeName,
      diff: diffMode,
      autoApprove,
      inputPath,
      mode: baselineMode,
    });
    if (!baselineRes.baselinePresent) {
      console.log(chalk.gray('   → Baseline repo missing; skipped fallback.'));
    } else if (baselineRes.logEntry?.added?.length) {
      const stats = Object.entries(baselineRes.stats)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      const stageBits = [
        baselineRes.logEntry?.added?.length ? `+${baselineRes.logEntry.added.length} added` : null,
        baselineRes.logEntry?.enriched?.length ? `≈${baselineRes.logEntry.enriched.length} enriched` : null,
        baselineRes.logEntry?.forced?.length ? `!${baselineRes.logEntry.forced.length} forced` : null,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(
        chalk.gray(
          `   → ${stageBits || 'Baseline fill'} from ${baselineRes.baselineName}${stats ? ` (${stats})` : ''}.`,
        ),
      );
      if (baselineRes.logPath) {
        console.log(chalk.gray(`   → Baseline log: ${path.relative(process.cwd(), baselineRes.logPath)}`));
      }
      if (baselineRes.diffPath && diffMode) {
        console.log(chalk.gray(`   → Baseline diff: ${path.relative(process.cwd(), baselineRes.diffPath)}`));
      }
    } else {
      console.log(chalk.gray('   → Already baseline-complete.'));
    }

    // Post-process CSS assets for deterministic url(...) rewrites
    // Declare timing vars once; assign inside try to avoid redeclaration lint
    let tCss1;
    try {
      const { normalizeCssAssets } = await import('./tools/normalize-css-assets.js');
      const tCssStart = Date.now();
      await normalizeCssAssets({ outputPath, inputPath });
      tCss1 = Date.now();
    } catch (_) { /* optional */ }

    // Optional i18n wrapping on output to reduce warnings automatically
    try {
      const { runFix } = await import('./tools/fix-i18n-output.js');
      await runFix(themeName);
    } catch (_) { /* optional */ }

    // Convert inline on* handlers to data-on-* to satisfy validator (preserves info)
    try {
      const { fixInlineHandlers } = await import('./tools/fix-inline-handlers.js');
      await fixInlineHandlers(themeName);
    } catch (_) { /* optional */ }

    // Verbose per-page, per-component progress
    if (verbose) {
      const writtenSet = new Set(adaptRes.written.map(w => w.replace(/\.twig$/,'').replace(/\\/g,'/')));
      const skippedSet = new Set(adaptRes.skipped.map(s => s.replace(/\\/g,'/')));
      for (const l of (parsed.layoutMap || [])) {
        const relHtml = l.page.replace(/\\/g,'/');
        const twigKey = relHtml.replace(/\.html$/i,'');
        const status = writtenSet.has(twigKey) ? 'written' : (skippedSet.has(relHtml) ? 'skipped' : 'pending');
        console.log(chalk.gray(`  • Page ${relHtml} → ${status}`));
        (l.components || []).forEach((c, idx) => {
          const sig = c.signature || c.classes || '';
          console.log(chalk.gray(`     - [${idx}] ${c.selector || 'section'} ${sig ? `(${sig})` : ''}`));
        });
      }
    }

    console.log(chalk.yellow("🧪 Running core validation..."));
    const tVal0 = Date.now();
    const coreReport = await validateTheme(outputPath);
    // Write a preliminary manifest so extended validator can read it
    try {
      const preManifest = await generateBuildManifest(outputPath, { coreReport, elapsedSec: 0, layoutMap: parsed.layoutMap, inputChecksum });
      await fs.writeJson(manifestPath, preManifest, { spaces: 2 });
    } catch (_) { /* non-blocking */ }
    // Fail gate on criticals unless --force
    const hasCritical = (coreReport.issues || []).some(i => i.level === 'critical');
    if (hasCritical && !args.includes('--force')) {
      console.error(chalk.red('Build failed: critical validator errors present. Use --force to override.'));
      process.exit(1);
    }

    console.log(chalk.yellow("🔬 Running extended QA..."));
    let extReport = await validateExtended(outputPath);
    const tVal1 = Date.now();
    const canonicalStatus =
      extReport?.summary?.passed === false || (extReport?.errors?.length ?? 0) > 0 ? "fail" : "pass";
    await updateCanonicalModel(themeName, (existing) => ({
      ...existing,
      validated: {
        status: canonicalStatus,
        warnings: formatIssues(extReport?.warnings || []),
        errors: formatIssues(extReport?.errors || []),
        counts: {
          warnings: extReport?.warnings?.length ?? 0,
          errors: extReport?.errors?.length ?? 0,
        },
      },
    }));

    // Optional auto-fix cycle for common issues
    if (autofix) {
      const hasMissingAssets = (extReport.errors || []).some(e => e.type === 'missing-assets');
      const hasSampleStrings = (extReport.errors || []).some(e => e.type === 'sample-strings');
      if (hasMissingAssets || hasSampleStrings) {
        try {
          const theme = path.basename(outputPath);
          console.log(chalk.yellow("🛠  Auto-fix: attempting to remediate common issues..."));
          const { fixMissingAssets } = await import('./tools/fix-missing-assets.js');
          await fixMissingAssets(theme);
        } catch (_) { /* noop */ }
        // Re-run extended validation after fixes
        extReport = await validateExtended(outputPath);
      }
    }

    // Salla assets sanity (icon/fonts/categories)
    try {
      const { validateSallaAssets } = await import('./tools/validate-salla-assets.js');
      await validateSallaAssets(themeName);
    } catch (_) { /* optional */ }

    if (prune) {
      console.log(chalk.yellow("🧹 Pruning orphan partials..."));
      const res = await prunePartials(outputPath, { archive: true, force: false });
      console.log(chalk.gray(`Removed ${res.removed.length} unused partial(s)`));
    }

    console.log(chalk.yellow("📜 Generating build manifest..."));
    const elapsed = Number(((Date.now() - start) / 1000).toFixed(2));
    const timings = {
      parseMs: tParse1 - tParse0,
      mapMs: tMap1 - tMap0,
      adaptMs: tAdapt1 - tAdapt0,
      cssNormalizeMs: typeof tCss1 === 'number' ? (tCss1 - tAdapt1) : 0,
      validateMs: tVal1 - tVal0,
      totalMs: Date.now() - t0
    };
    const manifest = await generateBuildManifest(outputPath, { coreReport, elapsedSec: elapsed, layoutMap: parsed.layoutMap, inputChecksum, performance: timings });
    await fs.writeJson(manifestPath, manifest, { spaces: 2 });

    // Write Salla-compatible theme.json for tooling interoperability
    const themeJson = {
      name: themeName,
      display_name: themeName,
      version: manifest.version || "1.0.0",
      description: "Generated by Deemind — Salla Theme",
      adapter: "Salla",
      engine: "twig",
      layout: "layout/default.twig",
      author: "Deemind",
      license: "UNLICENSED",
      categories: DEFAULT_THEME_META.categories,
      icon: DEFAULT_THEME_META.icon,
      fonts: DEFAULT_THEME_META.fonts,
      settings: DEFAULT_THEME_META.settings
    };
    await fs.writeJson(path.join(outputPath, "theme.json"), themeJson, { spaces: 2 });

    // Conversion report (what succeeded vs not)
    const critical = (coreReport.issues || []).filter(i => i.level === 'critical').length;
    const warnings = (coreReport.issues || []).filter(i => i.level !== 'critical').length;
    const convReport = {
      theme: path.basename(outputPath),
      timestamp: new Date().toISOString(),
      totals: {
        pagesDetected: parsed.pages.length,
        pagesWritten: adaptRes.written.length,
        pagesSkipped: adaptRes.skipped.length,
        conflicts: parsed.conflicts.length,
        failedInputs: parsed.failed.length,
        jsExtracted: Object.values(parsed.jsMap || {}).reduce((a,b)=>a+(b?.length||0),0)
      },
      files: {
        writtenPages: adaptRes.written,
        skippedPages: adaptRes.skipped,
        failedInputs: parsed.failed
      },
      validator: { critical, warnings }
    };
    await fs.writeJson(path.join(outputPath, 'conversion-report.json'), convReport, { spaces: 2 });

    // Per-page reports (action + components)
    const pageReportsDir = path.join(outputPath, 'reports', 'pages');
    await fs.ensureDir(pageReportsDir);
    const layoutByPage = new Map((parsed.layoutMap || []).map(l => [l.page.replace(/\\/g,'/'), l.components || []]));
    const writtenSet2 = new Set(adaptRes.written.map(w => w.replace(/\\/g,'/')));
    const skippedSet2 = new Set(adaptRes.skipped.map(s => s.replace(/\\/g,'/')));
    for (const htmlPage of (parsed.pages || []).map(p => p.rel.replace(/\\/g,'/'))) {
      const pageTwig = htmlPage.replace(/\.html$/i, '.twig');
      const action = writtenSet2.has(pageTwig) ? 'written' : (skippedSet2.has(htmlPage) ? 'skipped' : 'pending');
      const components = layoutByPage.get(htmlPage) || [];
      const jsCount = (parsed.jsMap && parsed.jsMap[htmlPage]) ? parsed.jsMap[htmlPage].length : 0;
      const pageReport = { pageHtml: htmlPage, pageTwig, action, components, jsExtracted: jsCount };
      await fs.writeJson(path.join(pageReportsDir, `${pageTwig.replace(/[\\/]/g,'_')}.json`), pageReport, { spaces: 2 });
    }

    // Component usage report (standard vs custom)
    const baselineSet = loadBaselineSet();
    const usage = computeComponentUsage(outputPath, baselineSet);
    await fs.writeJson(path.join(outputPath, 'reports', 'component-usage.json'), usage, { spaces: 2 });
    // timings already computed above
    console.log(chalk.gray(`Timings(ms): ${JSON.stringify(timings)}`));
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summary = [
        `Build: ${themeName}`,
        `Total: ${timings.totalMs}ms`,
        `Parse: ${timings.parseMs}ms, Map: ${timings.mapMs}ms, Adapt: ${timings.adaptMs}ms, CSS: ${timings.cssNormalizeMs}ms, Validate: ${timings.validateMs}ms`,
        `Pages: ${parsed.pages.length}, Written: ${adaptRes.written.length}, Skipped: ${adaptRes.skipped.length}`
      ].join('\n');
      try { await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${summary}\n`); } catch (e) { void e; }
    }
    await generateStaticPreview(themeName, { silent: true });
    const previewMeta = await preparePreview(themeName, {
      outputPath: outputRoot,
      port: previewConfig.port || PREVIEW_DEFAULTS.port,
    });
    let previewServerResult = null;
    if (previewConfig.enabled) {
      if (previewMeta.status === 'ready') {
        previewServerResult = await runPreviewServer(themeName, previewConfig);
        if (previewServerResult?.url) {
          console.log(chalk.green(`🟢 Preview server ready → ${previewServerResult.url}`));
        }
      } else {
        console.log(chalk.yellow('⚠️ Preview skipped: no pages were generated.'));
      }
    }
    await enrichBuildManifest({
      manifestPath,
      themeName,
      outputPath,
      previewMeta,
      previewResult: previewServerResult,
    });

    await appendBaselineMetrics(themeName, baselineRes, extReport);

    console.log(chalk.greenBright(`\n✅ Deemind build complete in ${elapsed}s`));
    console.log(chalk.gray(`Output → ${outputPath}`));

  } catch (err) {
    console.error(chalk.redBright("\n❌ Deemind build failed:\n"), err.message || err);
    if (process.env.DEEMIND_DEBUG) {
      console.error(err);
      if (err && err.stack) {
        console.error(chalk.gray(err.stack));
      }
    }
    process.exit(1);
  }
}

run();

async function hashInputDir(dir) {
  const crypto = await import('crypto');
  const gm = await import('glob');
  const syncFn = gm.globSync || (gm.default && gm.default.sync);
  const files = syncFn ? syncFn('**/*', { cwd: dir, nodir: true }) : [];
  const h = crypto.createHash('md5');
  for (const rel of files) {
    try {
      const buf = await fs.readFile(path.join(dir, rel));
      h.update(buf);
    } catch (err) { void err; }
  }
  return h.digest('hex');
}
async function appendBaselineMetrics(themeName, baselineInfo, extReport) {
  const metricsDir = path.resolve("reports");
  await fs.ensureDir(metricsDir);
  const metricsPath = path.join(metricsDir, "baseline-metrics.md");
  if (!(await fs.pathExists(metricsPath))) {
    await fs.writeFile(
      metricsPath,
      "| Theme | Added | Skipped | Duration | Errors | Warnings |\n| --- | --- | --- | --- | --- | --- |\n",
      "utf8"
    );
  }
  const added = baselineInfo?.logEntry?.added?.length ?? 0;
  const skipped = baselineInfo?.logEntry?.skipped?.length ?? 0;
  const duration = baselineInfo?.logEntry?.duration ?? "-";
  const errors = extReport?.errors?.length ?? 0;
  const warnings = extReport?.warnings?.length ?? 0;
  const row = `| ${themeName} | ${added} | ${skipped} | ${duration} | ${errors} | ${warnings} |\n`;
  await fs.appendFile(metricsPath, row, "utf8");
}

async function enrichBuildManifest({ manifestPath, themeName, outputPath, previewMeta, previewResult }) {
  const base = (await fs.readJson(manifestPath).catch(() => null)) || { theme: themeName };
  const previewPages = Array.isArray(previewMeta?.pages) ? previewMeta.pages : [];
  const previewRoutes = Array.from(new Set(previewPages.map(formatPreviewRoute).filter(Boolean)));
  const previewPort = previewResult?.port ?? previewMeta?.port ?? null;
  const previewUrl =
    previewResult?.url || previewMeta?.url || (previewPort ? `http://localhost:${previewPort}/` : null);
  const rel = (file) => toPosixPath(path.relative(process.cwd(), path.join(outputPath, file)));
  const packageFile = path.join(outputPath, `${themeName}.zip`);
  const packageExists = await fs.pathExists(packageFile).catch(() => false);

  const manifest = {
    ...base,
    theme: base.theme || themeName,
    buildTime: new Date().toISOString(),
    preview: {
      port: previewPort,
      url: previewUrl,
      routes: previewRoutes.length ? previewRoutes : ['/'],
    },
    reports: {
      extended: rel('report-extended.json'),
      core: rel('report.json'),
    },
    delivery: {
      package: rel(`${themeName}.zip`),
      packageExists,
    },
  };

  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

function formatPreviewRoute(entry) {
  if (!entry) return '/';
  const normalized = String(entry)
    .replace(/^pages?\//i, '')
    .replace(/index$/i, '')
    .replace(/^\//, '')
    .replace(/\\/g, '/');
  return normalized ? `/${normalized}` : '/';
}

function toPosixPath(relPath) {
  return relPath.split(path.sep).join('/');
}

function formatIssues(list, limit = 25) {
  return (list || [])
    .slice(0, limit)
    .map((issue) => {
      if (!issue) return "";
      if (typeof issue === "string") return issue;
      const parts = [];
      if (issue.type) parts.push(String(issue.type));
      if (issue.file) parts.push(String(issue.file));
      if (issue.message) parts.push(String(issue.message));
      return parts.join(" | ");
    })
    .filter(Boolean);
}

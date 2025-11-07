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

import { runHybridParser } from "./tools/deemind-parser/hybrid-runner.js";
import { mapSemantics } from "./tools/deemind-parser/semantic-mapper.js";
import { adaptToSalla } from "./tools/adapter.js";
import { validateTheme, generateBuildManifest } from "./tools/validator.js";
import { validateExtended } from "./tools/validator-extended.js";
import { prunePartials } from "./tools/partials-prune.js";
import { loadBaselineSet, computeComponentUsage } from "./tools/baseline-compare.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  const inputPath = path.join(__dirname, "input", themeName);
  const outputPath = path.join(__dirname, "output", themeName);

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

  try {
    console.log(chalk.yellow("🔍 Parsing HTML structure (hybrid)..."));
    const parsed = await runHybridParser(inputPath);

    console.log(chalk.yellow("🧠 Mapping semantics and Twig variables..."));
    const mapped = await mapSemantics(parsed, { i18n, client, sanitize });

    console.log(chalk.yellow("🪄 Adapting to Salla theme format..."));
    const adaptRes = await adaptToSalla(mapped, outputPath, { lockUnchanged, partialize });

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
    const coreReport = await validateTheme(outputPath);
    // Fail gate on criticals unless --force
    const hasCritical = (coreReport.issues || []).some(i => i.level === 'critical');
    if (hasCritical && !args.includes('--force')) {
      console.error(chalk.red('Build failed: critical validator errors present. Use --force to override.'));
      process.exit(1);
    }

    console.log(chalk.yellow("🔬 Running extended QA..."));
    let extReport = await validateExtended(outputPath);

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

    if (prune) {
      console.log(chalk.yellow("🧹 Pruning orphan partials..."));
      const res = await prunePartials(outputPath, { archive: true, force: false });
      console.log(chalk.gray(`Removed ${res.removed.length} unused partial(s)`));
    }

    console.log(chalk.yellow("📜 Generating build manifest..."));
    const elapsed = Number(((Date.now() - start) / 1000).toFixed(2));
    const inputChecksum = await hashInputDir(inputPath);
    const manifest = await generateBuildManifest(outputPath, { coreReport, elapsedSec: elapsed, layoutMap: parsed.layoutMap, inputChecksum });
    await fs.writeJson(path.join(outputPath, "manifest.json"), manifest, { spaces: 2 });

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
    const baseline = loadBaselineSet();
    const usage = computeComponentUsage(outputPath, baseline);
    await fs.writeJson(path.join(outputPath, 'reports', 'component-usage.json'), usage, { spaces: 2 });
    console.log(chalk.greenBright(`\n✅ Deemind build complete in ${elapsed}s`));
    console.log(chalk.gray(`Output → ${outputPath}`));

  } catch (err) {
    console.error(chalk.redBright("\n❌ Deemind build failed:\n"), err.message || err);
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

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

import { parseFolder } from "./tools/deemind-parser/parser.js";
import { mapSemantics } from "./tools/deemind-parser/semantic-mapper.js";
import { adaptToSalla } from "./tools/adapter-salla.js";
import { validateTheme } from "./tools/validator.js";
import { validateExtended } from "./tools/validator-extended.js";
import { generateBuildManifest } from "./tools/build-tracker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  try {
    console.log(chalk.yellow("🔍 Parsing HTML structure..."));
    const parsed = await parseFolder(inputPath);

    console.log(chalk.yellow("🧠 Mapping semantics and Twig variables..."));
    const mapped = await mapSemantics(parsed);

    console.log(chalk.yellow("🪄 Adapting to Salla theme format..."));
    await adaptToSalla(mapped, outputPath);

    console.log(chalk.yellow("🧪 Running core validation..."));
    await validateTheme(outputPath);

    console.log(chalk.yellow("🔬 Running extended QA..."));
    await validateExtended(outputPath);

    console.log(chalk.yellow("📜 Generating build manifest..."));
    const manifest = await generateBuildManifest(outputPath);
    await fs.writeJson(path.join(outputPath, "manifest.json"), manifest, { spaces: 2 });

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(chalk.greenBright(`\n✅ Deemind build complete in ${elapsed}s`));
    console.log(chalk.gray(`Output → ${outputPath}`));

  } catch (err) {
    console.error(chalk.redBright("\n❌ Deemind build failed:\n"), err.message || err);
    process.exit(1);
  }
}

run();

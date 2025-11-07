#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { listFiles, compareFiles } from "./utils/dirDiff.js";

const cfg = JSON.parse(fs.readFileSync("tests/snapshots/snapshot.config.json", "utf8"));
let total = 0, failed = 0;

for (const c of cfg.cases) {
  console.log(`\n🧪 Snapshot: ${c.name}`);
  if (c.buildCommand) {
    console.log(`   ▶ running build: ${c.buildCommand}`);
    try {
      execSync(c.buildCommand, { stdio: "inherit" });
    } catch {
      console.error("   ❌ build failed — aborting snapshot comparison.");
      process.exit(1);
    }
  }

  const include = cfg.compare.includeExtensions || [];
  const ignore  = cfg.compare.ignorePaths || [];
  const expRoot = path.resolve(c.expected);
  const actRoot = path.resolve(`output/${c.name}`);

  if (!fs.existsSync(expRoot)) {
    console.error(`   ❌ expected snapshot missing: ${expRoot}`);
    process.exit(1);
  }
  if (!fs.existsSync(actRoot)) {
    console.error(`   ❌ actual build missing: ${actRoot}`);
    process.exit(1);
  }

  const expFiles = listFiles(expRoot, include, ignore);
  const actFiles = listFiles(actRoot, include, ignore);

  const expOnly = expFiles.filter(f => !actFiles.includes(f));
  const actOnly = actFiles.filter(f => !expFiles.includes(f));

  if (expOnly.length) {
    console.error(`   ❌ missing in actual:\n      - ${expOnly.join("\n      - ")}`);
    failed += expOnly.length;
  }
  if (actOnly.length) {
    console.error(`   ❌ extra in actual:\n      + ${actOnly.join("\n      + ")}`);
    failed += actOnly.length;
  }

  const ignoreJsonKeys = cfg.compare.ignoreJsonKeys || [];
  const normalizeWhitespace = !!cfg.compare.normalizeWhitespace;

  for (const rel of expFiles) {
    total++;
    if (!actFiles.includes(rel)) continue;
    const diff = compareFiles(actRoot, expRoot, rel, ignoreJsonKeys, normalizeWhitespace);
    if (diff) {
      failed++;
      console.error(`   ❌ diff: ${rel}`);
      console.error(`      expected#${diff.expectedHash} vs actual#${diff.actualHash}`);
      console.error(`      --- expected preview ---\n${diff.expectedPreview}\n      --- actual preview ---\n${diff.actualPreview}\n`);
    }
  }

  if (failed === 0) {
    console.log(`   ✅ ${c.name} matches snapshots.`);
  }
}

console.log(`\n📊 Snapshot summary: ${total} files compared • ${failed} diffs`);
process.exit(failed ? 1 : 0);


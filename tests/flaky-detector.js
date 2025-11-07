#!/usr/bin/env node
import fs from "fs";
import path from "path";

const HISTORY_DIR = "logs/history";
const CATALOG     = JSON.parse(fs.readFileSync("tools/error-catalog.json", "utf8"));
const WINDOW      = 15;         // last N runs to consider
const THRESHOLD   = 0.30;       // 30% or more occurrence = flaky

if (!fs.existsSync(HISTORY_DIR)) {
  console.log("ℹ️ no logs/history yet — skipping flakiness check.");
  process.exit(0);
}

const files = fs.readdirSync(HISTORY_DIR)
  .filter(f => f.endsWith(".log") || f.endsWith(".txt") || f.endsWith(".json"))
  .sort()
  .slice(-WINDOW);

const patterns = CATALOG.map(r => ({ id: r.id, re: new RegExp(r.pattern, "i") }));
const counts = Object.fromEntries(patterns.map(p => [p.id, 0]));

for (const f of files) {
  const content = fs.readFileSync(path.join(HISTORY_DIR, f), "utf8");
  for (const p of patterns) {
    if (p.re.test(content)) counts[p.id]++;
  }
}

const rows = [];
let offenders = 0;
for (const p of patterns) {
  const seen = counts[p.id] || 0;
  const rate = files.length ? seen / files.length : 0;
  rows.push({ id: p.id, seen, runs: files.length, rate });
  if (rate >= THRESHOLD) offenders++;
}

rows.sort((a,b) => b.rate - a.rate);

console.log("\n🧯 Flaky Detector — last", files.length, "runs\n");
for (const r of rows) {
  const pct = (r.rate * 100).toFixed(0).padStart(3, " ");
  const bar = "█".repeat(Math.max(1, Math.round(r.rate * 20)));
  console.log(`${pct}%  ${bar}  ${r.id} (${r.seen}/${r.runs})`);
}

if (offenders) {
  console.error(`\n❌ Flaky threshold exceeded (${offenders} patterns ≥ ${(THRESHOLD*100)|0}%).`);
  process.exit(1);
}
console.log("\n✅ No flaky patterns exceeded threshold.");


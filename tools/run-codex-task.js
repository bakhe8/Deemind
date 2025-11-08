#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

const task = process.argv[2];
if (!task) {
  console.error('Usage: npm run codex:run <task>');
  process.exit(1);
}

const started = new Date().toISOString();
console.log(`🧠 Codex executing Deemind task: ${task}`);
let status = 'success';
try {
  execSync(`npm run ${task}`, { stdio: 'inherit' });
} catch (e) {
  status = 'failure';
}
const finished = new Date().toISOString();

// Log task
const logsDir = path.join(process.cwd(), 'logs');
const tasksLog = path.join(logsDir, 'codex-tasks.json');
await fs.ensureDir(logsDir);
let arr = [];
try { arr = JSON.parse(await fs.readFile(tasksLog, 'utf8')); if (!Array.isArray(arr)) arr = []; } catch {}
arr.push({ task, status, started, finished });
await fs.writeJson(tasksLog, arr, { spaces: 2 });

// Simple report
const repDir = path.join(process.cwd(), 'reports');
await fs.ensureDir(repDir);
const safe = task.replace(/[^a-zA-Z0-9:_-]/g, '_');
await fs.writeFile(path.join(repDir, `codex-task-${safe}.md`), `# Codex Task\n\n- Task: ${task}\n- Status: ${status}\n- Started: ${started}\n- Finished: ${finished}\n`);

console.log(`✅ Task ${task} completed with status: ${status}. See /reports/codex-task-${safe}.md`);

// Refresh Harmony and dashboard (best effort)
try {
  execSync('npm run codex:update-harmony', { stdio: 'inherit' });
} catch {}
try {
  execSync('node tools/update-dashboard.js', { stdio: 'inherit' });
} catch {}

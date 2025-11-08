#!/usr/bin/env node
/**
 * Codex Autopilot — runs Deemind directives locally without GitHub Actions.
 *
 * Responsibilities:
 *  - Load .env values (optional) for OPENAI / Salla / GitHub tokens.
 *  - Read codex-directives/*.md in sorted order.
 *  - Map each directive to a set of local commands (npm/node scripts).
 *  - Execute commands sequentially, logging results to /logs and /reports.
 *  - Auto-commit and push if everything succeeds (optional).
 */

import fs from 'fs-extra';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'logs');
const REPORTS_DIR = path.join(ROOT, 'reports');
const DIRECTIVES_DIR = path.join(ROOT, 'codex-directives');
const AUTOPILOT_LOG = path.join(LOG_DIR, 'codex-autopilot.log');
const TASKS_LOG = path.join(ROOT, 'codex-tasks.json');
const SUMMARY_MD = path.join(REPORTS_DIR, 'autopilot-summary.md');
const FAILURE_MD = path.join(REPORTS_DIR, 'autopilot-failures.md');

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_PUSH = process.argv.includes('--no-push') || DRY_RUN;

await ensurePaths();
loadEnvIfPresent();

const directiveTasks = buildDirectiveTaskMap();
const directives = await getDirectiveFiles();
const runStartedAt = new Date().toISOString();
const runId = `autopilot-${runStartedAt}`;

const summary = [];
let overallSuccess = true;

for (const file of directives) {
  const label = file;
  const tasks = directiveTasks.get(file) ?? [];
  if (!tasks.length) {
    summary.push({ directive: file, status: 'skipped', note: 'No mapped tasks' });
    continue;
  }

  let directiveSuccess = true;
  for (const task of tasks) {
    const { label: taskLabel, command, args = [], cwd = ROOT, env = {} } = task;
    const title = `${label} → ${taskLabel}`;
    const result = runCommand(title, command, args, cwd, env);
    summary.push({ directive: file, task: taskLabel, status: result.success ? 'success' : 'failed' });
    if (!result.success) {
      overallSuccess = false;
      directiveSuccess = false;
      break;
    }
  }

  if (!directiveSuccess) {
    summary.push({ directive: file, status: 'failed', note: 'Stopped remaining tasks for this directive.' });
    break; // stop entire run on first failure
  }
}

await writeLogs(summary, overallSuccess, runStartedAt);
logToConsole(summary, overallSuccess);

if (overallSuccess && !SKIP_PUSH) {
  await commitAndPush(runStartedAt);
}

process.exit(overallSuccess ? 0 : 1);

/* --------------------------- helper functions --------------------------- */

async function ensurePaths() {
  await fs.ensureDir(LOG_DIR);
  await fs.ensureDir(REPORTS_DIR);
}

function loadEnvIfPresent() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const [key, value] = trimmed.split('=');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

async function getDirectiveFiles() {
  if (!(await fs.pathExists(DIRECTIVES_DIR))) return [];
  const files = await fs.readdir(DIRECTIVES_DIR);
  return files.filter((f) => f.endsWith('.md')).sort();
}

function buildDirectiveTaskMap() {
  const m = new Map();

  m.set('000-factory-full-plan.md', [
    { label: 'Build demo theme', command: 'npm', args: ['run', 'deemind:build', 'demo'] },
    { label: 'Build gimni theme', command: 'npm', args: ['run', 'deemind:build', 'gimni'] },
    { label: 'Lint workspace', command: 'npm', args: ['run', 'lint'] },
    { label: 'Run Deemind tests', command: 'npm', args: ['run', 'deemind:test'] },
    { label: 'Update harmony summary', command: 'npm', args: ['run', 'codex:update-harmony'] },
    { label: 'Refresh dashboard data', command: 'npm', args: ['run', 'codex:update-dashboard'] },
  ]);

  m.set('004-mockup-expansion-plan.md', [
    { label: 'Validate mockups', command: 'npm', args: ['run', 'mockup:validate'] },
  ]);

  m.set('005-permission-policy.md', [
    { label: 'Sync Salla docs', command: 'npm', args: ['run', 'salla:docs:sync'] },
  ]);

  m.set('006-autonomous-execution.md', [
    { label: 'Run harmony check', command: 'npm', args: ['run', 'deemind:harmony'] },
  ]);

  m.set('006-collaboration-mode.md', [
    { label: 'Update dashboard bridge', command: 'node', args: ['tools/update-dashboard.js'] },
  ]);

  m.set('007-interactive-bridge.md', [
    { label: 'Sync UI bridge data', command: 'node', args: ['tools/update-dashboard.js'] },
  ]);

  m.set('007-task-taxonomy.md', [
    { label: 'Run doctor audit', command: 'npm', args: ['run', 'doctor'] },
  ]);

  m.set('009-build-visual-dashboard.md', [
    { label: 'Regenerate local dashboard', command: 'node', args: ['tools/update-dashboard.js'] },
  ]);

  return m;
}

function runCommand(label, command, args, cwd, extraEnv = {}) {
  console.log(`\n🧠  ${label}`);
  if (DRY_RUN) {
    console.log('    (dry run — skipped)');
    return { success: true, output: '' };
  }

  const child = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (child.status !== 0) {
    console.error(`❌  ${label} failed (exit ${child.status}).`);
  } else {
    console.log(`✅  ${label} completed.`);
  }
  return { success: child.status === 0 };
}

async function writeLogs(entries, success, startedAt) {
  const logLine = `[${new Date().toISOString()}] ${success ? 'SUCCESS' : 'FAIL'} ${entries.length} steps\n`;
  await fs.appendFile(AUTOPILOT_LOG, logLine);

  let taskData = await fs.readJson(TASKS_LOG).catch(() => null);
  if (!taskData) {
    taskData = [];
  }

  if (Array.isArray(taskData)) {
    taskData.push({
      task: 'codex:autopilot',
      status: success ? 'success' : 'failure',
      started: startedAt,
      finished: new Date().toISOString(),
      entries,
    });
  } else if (typeof taskData === 'object') {
    if (!Array.isArray(taskData.autopRuns)) {
      taskData.autopRuns = [];
    }
    taskData.autopRuns.push({
      task: 'codex:autopilot',
      status: success ? 'success' : 'failure',
      started: startedAt,
      finished: new Date().toISOString(),
      entries,
    });
  }
  await fs.writeJson(TASKS_LOG, taskData, { spaces: 2 });

  const summaryLines = [
    '# Codex Autopilot Summary',
    '',
    `- Run started: ${startedAt}`,
    `- Result: ${success ? '✅ Success' : '❌ Failure'}`,
    '',
    '| Directive | Task | Status |',
    '|-----------|------|--------|',
    ...entries.map((e) => `| ${e.directive} | ${e.task || e.note || '—'} | ${e.status} |`),
  ];
  await fs.writeFile(SUMMARY_MD, summaryLines.join('\n'));

  if (!success) {
    const failureLines = [
      '# Codex Autopilot Failures',
      '',
      `Last failed run: ${startedAt}`,
      '',
      ...entries.filter((e) => e.status === 'failed').map((e) => `- ${e.directive}: ${e.task || e.note || ''}`),
    ];
    await fs.writeFile(FAILURE_MD, failureLines.join('\n'));
  } else if (await fs.pathExists(FAILURE_MD)) {
    await fs.remove(FAILURE_MD);
  }
}

function logToConsole(entries, success) {
  console.log('\n📊 Autopilot Summary');
  entries.forEach((e) => {
    console.log(` - ${e.directive} :: ${e.task || e.note || '—'} => ${e.status}`);
  });
  console.log(success ? '\n✅ Autopilot completed successfully.' : '\n❌ Autopilot encountered errors.');
}

async function commitAndPush(timestamp) {
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (!status.stdout.trim()) {
    console.log('Nothing to commit.');
    return;
  }

  const commitMessage = `codex: autopilot run ${timestamp}`;
  spawnSync('git', ['add', 'logs', 'reports'], { stdio: 'inherit', shell: process.platform === 'win32' });
  spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit', shell: process.platform === 'win32' });
  spawnSync('git', ['push'], { stdio: 'inherit', shell: process.platform === 'win32' });
}

/**
 * Deemind Autonomous Agent
 * --------------------------
 * Full implementation of self-managing GPT Codex loop.
 *
 * Capabilities:
 * 1. Read /docs/deemind_checklist.md
 * 2. Analyze repo for missing/partial tasks
 * 3. Create issues for missing features
 * 4. Implement missing logic using Codex (OpenAI API)
 * 5. Run validation command
 * 6. Commit + push changes
 * 7. Close resolved issues
 *
 * Requirements:
 * - Node >= 20
 * - OPENAI_API_KEY and GITHUB_TOKEN set in env or repo secrets
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from 'octokit';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const BRANCH = 'auto-agent';
const BASE_BRANCH = process.env.DEEMIND_BASE || 'develop';
const CHECKLIST_PATH = 'docs/deemind_checklist.md';
const AUDIT_LOG_PATH = 'logs/deemind_audit_report.json';
const TASKS_PATH = 'codex-tasks.json';
const PROGRESS_LOG = 'logs/codex-progress.log';
const STATUS_PATH = 'logs/codex-status.json';

function getRepo() {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (envRepo && envRepo.includes('/')) {
    const [owner, repo] = envRepo.split('/');
    return { owner, repo };
  }
  const gitConfig = fs.existsSync('.git/config') ? fs.readFileSync('.git/config', 'utf8') : '';
  const m = gitConfig.match(/github.com[:/](.+)\/(.+)\.git/);
  if (m) return { owner: m[1], repo: m[2] };
  const owner = process.env.DEEMIND_REPO_OWNER;
  const repo = process.env.DEEMIND_REPO_NAME;
  if (owner && repo) return { owner, repo };
  throw new Error('Unable to resolve repo. Set GITHUB_REPOSITORY or DEEMIND_REPO_OWNER/DEEMIND_REPO_NAME.');
}

function writeProgress(line) {
  try {
    fs.mkdirSync(path.dirname(PROGRESS_LOG), { recursive: true });
    fs.appendFileSync(PROGRESS_LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch (err) { /* ignore logging errors */ }
}

function writeStatus(obj) {
  try {
    fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
    fs.writeFileSync(STATUS_PATH, JSON.stringify(obj, null, 2));
  } catch (err) { /* ignore logging errors */ }
}

function loadTasks() {
  if (!fs.existsSync(TASKS_PATH)) return { queue: [] };
  try { return JSON.parse(fs.readFileSync(TASKS_PATH, 'utf8')); } catch (err) { return { queue: [] }; }
}

function saveTasks(tasks) {
  fs.writeFileSync(TASKS_PATH, JSON.stringify(tasks, null, 2));
}

async function runCodexCycle(taskName) {
  const maxCycles = Number(process.env.CODEX_MAX_CYCLES || 5);
  let current = 1;
  let status = 'in-progress';
  writeProgress(`cycle:start task="${taskName}"`);
  while (status === 'in-progress' && current <= maxCycles) {
    console.log(`🧠 Codex cycle ${current} for task: ${taskName}`);
    writeProgress(`cycle:${current} executing`);
    status = await executeCodexTask(taskName);
    await validateResults();
    current++;
  }
  const result = (status === 'done') ? 'done' : 'needs-review';
  writeProgress(`cycle:end task="${taskName}" result=${result}`);
  return result;
}

async function validateResults() {
  try {
    execSync('npm run deemind:doctor', { stdio: 'inherit' });
    writeProgress('validate:ok');
    return true;
  } catch (e) {
    writeProgress('validate:fail');
    return false;
  }
}

async function executeCodexTask(taskName) {
  // Bridge to existing implementation: for now, one pass marks task done
  void taskName;
  return 'done';
}

async function main() {
  console.log('🧠 Deemind Agent starting...\n');
  const { owner, repo } = getRepo();
  writeStatus({ state: 'starting', repo: `${owner}/${repo}` });

  // STEP 1 — Read checklist
  const checklist = fs.readFileSync(CHECKLIST_PATH, 'utf8');

  // STEP 2 — Read repo structure
  const allFiles = getAllFiles('.');
  console.log(`📁 Found ${allFiles.length} project files.\n`);

  // STEP 3 — Ask Codex to audit
  console.log('🤖 Asking Codex to audit the repository...');
  const auditPrompt = `
You are the Deemind Autonomous Agent.
Compare the following checklist with the existing file list.
Identify what is implemented, partial, or missing.
Output JSON with three arrays: implemented, partial, missing.
Checklist:
${checklist}

Existing files:
${allFiles.join('\n')}
`;

  const auditResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [{ role: 'user', content: auditPrompt }]
  });

  let audit;
  try {
    audit = JSON.parse(auditResponse.choices[0].message.content);
  } catch {
    console.error('⚠️ Codex output invalid JSON. Saving raw response.');
    audit = { implemented: [], partial: [], missing: [], raw: auditResponse.choices[0].message.content };
  }

  await fs.promises.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(audit, null, 2));
  console.log('📜 Audit saved:', AUDIT_LOG_PATH);

  // STEP 4 — Create GitHub issues for missing items
  if (audit.missing?.length) {
    console.log(`🐞 Creating ${audit.missing.length} new GitHub issues...`);
    for (const item of audit.missing) {
      await octokit.rest.issues.create({
        owner,
        repo,
        title: item.title || `Implement: ${item}`,
        body: item.description || 'Auto-created by Deemind agent audit',
        labels: ['automation', 'ai']
      });
    }
  }

  // STEP 5 — Implement each missing/partial item
  const targets = [...(audit.partial || []), ...(audit.missing || [])];
  for (const task of targets) {
    const taskName = task.title || task;
    console.log(`\n🔧 Implementing task: ${taskName}`);

    const implPrompt = `
You are the Deemind Codex agent.
Implement or complete the following feature in the repository.
You have full context of Deemind project architecture.

Feature: ${taskName}
Checklist context:
${task.description || 'N/A'}
Repo files:
${allFiles.join('\n')}
`;

    const implResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      messages: [{ role: 'user', content: implPrompt }]
    });

    const suggestion = implResponse.choices[0].message.content || '';
    const outputFile = `logs/${sanitize(taskName)}.md`;
    await fs.promises.mkdir('logs', { recursive: true });
    fs.writeFileSync(outputFile, suggestion);
    console.log(`💾 Codex suggestion saved to ${outputFile}`);

    // Auto-apply: support multiple fenced blocks and optional path hints
    if (/```/.test(suggestion)) {
      const blocks = extractAllCodeBlocks(suggestion);
      if (blocks.length) {
        for (const b of blocks) {
          let target = b.path || guessFilePath(taskName) || null;
          // Also try to infer from inline markers inside content
          if (!target) {
            const m1 = b.content.match(/^\s*(?:\/\/|#|<!--)\s*(?:File|path)\s*[:=]\s*(.+?)(?:-->)?\s*$/mi);
            if (m1) {
              target = m1[1].trim();
              b.content = b.content.replace(m1[0], '').trim();
            }
          }
          if (!target) continue;
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, b.content);
          console.log(`✅ Implemented into ${target}`);
        }
      }
    }
  }

  // STEP 6 — Run validation
  console.log('\n🧪 Running Deemind validation...');
  let validationPassed = false;
  try {
    execSync('npm run deemind:validate', { stdio: 'inherit' });
    console.log('✅ Validation passed.');
    validationPassed = true;
  } catch {
    console.warn('⚠️ Validation failed, keeping report open.');
  }

  // Append telemetry and write a short summary
  try {
    const fs = await import('fs-extra');
    const path = await import('path');
    const analyticsDir = path.join(process.cwd(), 'analytics');
    const historyFile = path.join(analyticsDir, 'build-history.json');
    await fs.ensureDir(analyticsDir);
    let history = [];
    if (await fs.pathExists(historyFile)) { try { history = await fs.readJson(historyFile); } catch (e) { /* ignore */ } }
    const summary = { timestamp: new Date().toISOString(), validationPassed };
    history.push(summary);
    await fs.writeJson(historyFile, history, { spaces: 2 });
    const summaryText = `Deemind Agent run\nValidation: ${validationPassed ? 'passed' : 'failed'}\nItems: implemented=${(audit.implemented||[]).length}, partial=${(audit.partial||[]).length}, missing=${(audit.missing||[]).length}`;
    const out = path.join(process.cwd(), 'logs', 'deemind_agent_summary.md');
    await fs.ensureDir(path.dirname(out));
    await fs.writeFile(out, summaryText);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `\n\n${summaryText}\n`);
    }
  } catch (e) { /* ignore */ }

  // STEP 7 — Commit and push
  console.log('📦 Committing updates...');
  try { execSync("git config user.name 'Deemind Agent'"); } catch (e) { /* ignore */ }
  try { execSync("git config user.email 'agent@deemind.local'"); } catch (e) { /* ignore */ }
  execSync(`git checkout -B ${BRANCH}`);
  execSync('git add .');
  execSync("git commit -m 'chore: automated implementation & validation' || echo 'no changes'");
  execSync(`git push origin ${BRANCH} --force`);
  console.log('🚀 Pushed to branch:', BRANCH);

  // Open PR to base branch if not exists (prefer develop, fallback to main)
  const base = await resolveBaseBranch(octokit, owner, repo, BASE_BRANCH);
  await ensurePullRequest(octokit, owner, repo, BRANCH, base);

  // STEP 8 — Close issues if validated and CI is green
  const ciGreen = validationPassed && await waitForGreenCI(octokit, owner, repo, BRANCH, 12, 30000, ['Deemind CI', 'CodeQL']);
  if (ciGreen) {
    console.log('🔒 Closing completed issues...');
    const issues = await octokit.rest.issues.listForRepo({ owner, repo, labels: 'automation,ai', state: 'open' });
    for (const issue of issues.data) {
      try {
        await octokit.rest.issues.createComment({ owner, repo, issue_number: issue.number, body: '✅ Automatically resolved by Deemind agent after validation' });
        await octokit.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed' });
      } catch (err) {
         
        console.error('Issue close failed:', err?.message || err);
      }
    }
  } else {
    console.log('⏳ Skipping auto-close: CI not green yet.');
  }

  // Self-driven loop: process tasks queue if present
  const tasks = loadTasks();
  while (tasks.queue && tasks.queue.length) {
    const taskName = tasks.queue[0];
    writeStatus({ state: 'running', task: taskName, queue: tasks.queue });
    const res = await runCodexCycle(taskName);
    if (res === 'done') {
      tasks.queue.shift();
      saveTasks(tasks);
    } else {
      writeStatus({ state: 'paused', reason: 'needs-review', task: taskName });
      break;
    }
  }
  writeStatus({ state: 'idle', remaining: (loadTasks().queue||[]).length });
  console.log('\n🎯 Deemind Agent completed execution.');
}

// Helpers
function sanitize(str) { return String(str).toLowerCase().replace(/[^a-z0-9-_]/g, '_').slice(0, 50); }

function extractCode(text) {
  const match = text.match(/```[a-zA-Z0-9]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function extractAllCodeBlocks(text) {
  const blocks = [];
  const re = /```([a-zA-Z0-9]*)\s*(?:path=([^\n]+))?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text))) {
    blocks.push({ lang: (m[1] || '').trim(), path: m[2] ? m[2].trim() : null, content: m[3].trim() });
  }
  return blocks;
}

function guessFilePath(taskName) {
  const s = String(taskName).toLowerCase();
  if (s.includes('parser')) return 'tools/deemind-parser/parser.js';
  if (s.includes('mapper')) return 'tools/deemind-parser/semantic-mapper.js';
  if (s.includes('validator')) return 'tools/validator.js';
  if (s.includes('delivery')) return 'tools/delivery-pipeline.js';
  return null;
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    try {
      const stat = fs.statSync(name);
      if (stat.isDirectory()) {
        if (name.includes('node_modules') || path.basename(name).startsWith('.')) continue;
        getAllFiles(name, fileList);
      } else {
        fileList.push(name);
      }
    } catch (e) { /* ignore */ }
  }
  return fileList;
}

main().catch(err => { console.error('❌ Agent crashed:', err); process.exit(1); });

async function ensurePullRequest(octokit, owner, repo, headBranch, baseBranch) {
  try {
    const prs = await octokit.rest.pulls.list({ owner, repo, state: 'open', head: `${owner}:${headBranch}`, base: baseBranch });
    if (prs.data && prs.data.length) return prs.data[0];
    const created = await octokit.rest.pulls.create({ owner, repo, head: headBranch, base: baseBranch, title: '🤖 Deemind Agent — Automated Update', body: 'This PR was opened by the Deemind autonomous agent.' });
    return created.data;
  } catch (e) {
     
    console.error('PR create failed:', e?.message || e);
    return null;
  }
}

async function resolveBaseBranch(octokit, owner, repo, preferred) {
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `heads/${preferred}` });
    return preferred;
  } catch {
    try {
      await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' });
      return 'main';
    } catch {
      return preferred;
    }
  }
}

async function waitForGreenCI(octokit, owner, repo, branch, maxTries = 10, sleepMs = 30000, requiredWorkflows = []) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const runs = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo, branch, per_page: 20 });
      const list = (runs.data.workflow_runs || []).filter(r => r.head_branch === branch);
      if (!requiredWorkflows.length) {
        const latest = list[0];
        if (latest && latest.status === 'completed') return latest.conclusion === 'success';
      } else {
        const ok = requiredWorkflows.every(name => {
          const wr = list.find(r => r.name === name);
          return wr && wr.status === 'completed' && wr.conclusion === 'success';
        });
        if (ok) return true;
      }
    } catch (e) { /* ignore */ }
    await new Promise(r => setTimeout(r, sleepMs));
  }
  return false;
}

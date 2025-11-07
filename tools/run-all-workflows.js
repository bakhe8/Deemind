// Runs all GitHub workflows "one by one" as best-effort:
// 1) Dispatches workflow_dispatch-enabled workflows via API (if GITHUB_TOKEN present)
// 2) Creates a tiny commit on main to trigger push-based workflows
// 3) Prints a summary of what was triggered

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function maybeDispatch(workflowFile, owner, repo, token) {
  try {
    const yaml = fs.readFileSync(workflowFile, 'utf8');
    const hasDispatch = /\bworkflow_dispatch\b/.test(yaml);
    if (!hasDispatch || !token) return { dispatched: false, reason: hasDispatch ? 'no token' : 'no workflow_dispatch' };
    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: token });
    const fileName = path.basename(workflowFile);
    const ref = process.env.REF || 'main';
    await octokit.rest.actions.createWorkflowDispatch({ owner, repo, workflow_id: fileName, ref });
    return { dispatched: true };
  } catch (e) {
    return { dispatched: false, reason: e.message || String(e) };
  }
}

function getOwnerRepo() {
  const url = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
  const m = url.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!m) throw new Error('Cannot parse owner/repo from origin');
  return { owner: m[1], repo: m[2] };
}

async function main() {
  const wfDir = path.resolve('.github', 'workflows');
  const wfs = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).map(f => path.join(wfDir, f));
  const { owner, repo } = getOwnerRepo();
  const token = process.env.GITHUB_TOKEN || '';

  const results = [];
  for (const wf of wfs) {
    const r = await maybeDispatch(wf, owner, repo, token);
    results.push({ workflow: path.basename(wf), ...r });
  }

  // Create a tiny commit to trigger push workflows
  const pingDir = path.resolve('.ci');
  fs.mkdirSync(pingDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0,19);
  const pingFile = path.join(pingDir, `trigger-${stamp}.txt`);
  fs.writeFileSync(pingFile, `trigger ${stamp}`);
  execSync('git add -A');
  try { execSync(`git commit -m "chore(ci): trigger workflows ${stamp}"`, { stdio: 'inherit' }); } catch { /* no changes */ }
  execSync('git push origin HEAD', { stdio: 'inherit' });

  const out = { dispatched: results.filter(r=>r.dispatched).map(r=>r.workflow), skipped: results.filter(r=>!r.dispatched) };
  const reportPath = path.resolve('logs', `run-all-workflows-${stamp}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  console.log('Run-all-workflows summary →', reportPath);
}

main().catch(e => { console.error('run-all-workflows failed:', e); process.exit(1); });


// Polls GitHub Actions runs and writes a concise pass/fail digest.
// Env: GITHUB_TOKEN (required), OWNER/REPO optional (auto-detected from git remote).

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getOwnerRepo() {
  const envOwner = process.env.OWNER;
  const envRepo = process.env.REPO;
  if (envOwner && envRepo) return { owner: envOwner, repo: envRepo };
  const url = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
  const m = url.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!m) throw new Error('Cannot parse owner/repo from origin');
  return { owner: m[1], repo: m[2] };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('GITHUB_TOKEN not set; cannot poll Actions.');
    return;
  }
  const { Octokit } = await import('octokit');
  const octokit = new Octokit({ auth: token });
  const { owner, repo } = getOwnerRepo();
  const branch = process.env.BRANCH || 'main';

  const res = await octokit.rest.actions.listWorkflowRunsForRepo({ owner, repo, branch, per_page: 50 });
  const runs = (res.data.workflow_runs || []).slice(0, 20);
  const byWorkflow = new Map();
  for (const r of runs) {
    if (!byWorkflow.has(r.name)) byWorkflow.set(r.name, []);
    byWorkflow.get(r.name).push({ id: r.id, name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url, head_sha: r.head_sha, created_at: r.created_at });
  }

  const stamp = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
  const outDir = 'logs';
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `actions-monitor-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ branch, byWorkflow: Object.fromEntries(byWorkflow) }, null, 2));

  const lines = [];
  lines.push(`## Actions Digest (${branch}) — ${new Date().toISOString()}`);
  for (const [name, list] of byWorkflow.entries()) {
    const latest = list[0];
    const icon = latest.conclusion === 'success' ? '✅' : latest.conclusion === 'failure' ? '❌' : '⏳';
    lines.push(`- ${icon} ${name}: ${latest.status}/${latest.conclusion || 'pending'} — ${latest.url}`);
  }
  const mdPath = path.join('reports', `actions-summary-${stamp}.md`);
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, lines.join('\n') + '\n');
  console.log('Wrote:', jsonPath, 'and', mdPath);
}

main().catch(e => { console.error('monitor-actions error:', e.message || e); process.exit(1); });


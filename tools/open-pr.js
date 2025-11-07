// Opens a GitHub PR for the current branch using Octokit.
// Env: GITHUB_TOKEN (required). Optional OWNER/REPO.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Octokit } from 'octokit';

function sh(cmd) { return execSync(cmd, { encoding: 'utf8' }).trim(); }

function getOwnerRepo() {
  const envOwner = process.env.OWNER;
  const envRepo = process.env.REPO;
  if (envOwner && envRepo) return { owner: envOwner, repo: envRepo };
  // Parse from git remote origin
  const url = sh('git config --get remote.origin.url');
  // Cases: git@github.com:owner/repo.git or https://github.com/owner/repo.git
  const m = url.match(/[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
  if (!m) throw new Error('Cannot parse owner/repo from remote.origin.url');
  return { owner: m[1], repo: m[2] };
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GITHUB_TOKEN');
  const octokit = new Octokit({ auth: token });

  const { owner, repo } = getOwnerRepo();
  const branch = process.argv[2] || sh('git rev-parse --abbrev-ref HEAD');
  const base = process.env.BASE || 'main';

  // Prepare PR title/body
  const today = new Date().toISOString().slice(0, 10);
  const title = `Codex Auto-Evaluation — ${today}`;
  let body = 'Automated Codex evaluation. See attached suggestions and summary.\n\n';
  try {
    const reportsDir = path.resolve('reports');
    const files = fs.readdirSync(reportsDir).filter(f => /codex-summary-|codex-suggestions-/.test(f));
    for (const f of files) {
      const p = path.join(reportsDir, f);
      if (f.endsWith('.md')) body += `\n### ${f}\n\n` + fs.readFileSync(p, 'utf8') + '\n';
      if (f.endsWith('.json')) body += `\n<details><summary>${f}</summary>\n\n\n\n</details>\n`;
    }
  } catch (e) { void e; }

  // Check if PR already exists
  const prs = await octokit.rest.pulls.list({ owner, repo, state: 'open', head: `${owner}:${branch}` });
  if (prs.data.length) {
    console.log('PR already open:', prs.data[0].html_url);
    return;
  }

  const pr = await octokit.rest.pulls.create({ owner, repo, title, head: branch, base, body });
  console.log('Opened PR:', pr.data.html_url);
}

main().catch(e => { console.error('open-pr error:', e.message || e); process.exit(1); });


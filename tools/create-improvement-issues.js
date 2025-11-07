#!/usr/bin/env node
import fs from 'fs';
import { Octokit } from 'octokit';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repoEnv = process.env.GITHUB_REPOSITORY || '';
  let owner = process.env.OWNER, repo = process.env.REPO;
  if (repoEnv.includes('/')) { const parts = repoEnv.split('/'); owner = owner || parts[0]; repo = repo || parts[1]; }
  if (!token || !owner || !repo) {
    console.error('Missing env: GITHUB_TOKEN, OWNER/REPO');
    process.exit(1);
  }
  const octokit = new Octokit({ auth: token });

  const path = 'reports/codex-self-assessment.md';
  if (!fs.existsSync(path)) { console.error('Report not found:', path); process.exit(1); }
  const md = fs.readFileSync(path, 'utf8');
  // Parse recommendations lines in the table
  const lines = md.split(/\r?\n/);
  const tasks = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*([^|]+)\|\s*(\d+)\s*\|\s*(.+)\|\s*$/);
    if (m) {
      const cat = m[1].trim();
      const recs = m[3].split(';').map(s => s.trim()).filter(Boolean);
      for (const r of recs) tasks.push({ title: `[${cat}] ${r}`, body: `Category: ${cat}\n\nFrom codex-self-assessment.md\n\nRecommendation: ${r}` });
    }
  }

  // Existing open issues to avoid duplicates
  const existing = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 100, labels: 'codex-improvement' });
  const exists = new Set(existing.data.map(i => i.title.trim()));

  for (const t of tasks) {
    if (exists.has(t.title)) continue;
    await octokit.rest.issues.create({ owner, repo, title: t.title, body: t.body, labels: ['codex-improvement'] });
    console.log('Created improvement issue:', t.title);
  }
}

main().catch(e => { console.error(e); process.exit(1); });


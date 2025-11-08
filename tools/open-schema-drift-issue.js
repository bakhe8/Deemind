#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { Octokit } from 'octokit';

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY || '';
  if (!token || !repoFull) { console.log('No token or repo in env; skipping issue creation.'); return; }
  const [owner, repo] = repoFull.split('/');
  const reportPath = path.join(process.cwd(), 'reports', 'salla-schema-diff.md');
  if (!(await fs.pathExists(reportPath))) { console.log('No schema diff report; skipping.'); return; }
  const txt = await fs.readFile(reportPath, 'utf8');
  const m = txt.match(/Required fields missing \((\d+)\)/);
  const missingCount = m ? parseInt(m[1], 10) : 0;
  if (!missingCount) { console.log('No schema drift detected.'); return; }
  const body = `Schema drift detected. Please update configs/salla-schema.json or theme generation.\n\nReport:\n\n${txt}`;
  const octo = new Octokit({ auth: token });
  await octo.rest.issues.create({ owner, repo, title: '[codex-improvement] Salla schema drift detected — update required', body, labels: ['codex-improvement','salla','schema'] });
  console.log('Opened schema drift issue.');
}

main().catch(e => { console.error(e); process.exit(1); });


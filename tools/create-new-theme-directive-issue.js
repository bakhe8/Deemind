#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { Octokit } from 'octokit';

const TITLE = 'codex: directive — new theme generation behavior (official protocol)';

async function main() {
  const body = await fs.readFile(path.join(process.cwd(),'docs','codex-new-theme-directive.md'),'utf8');
  const reportsDir = path.join(process.cwd(),'reports');
  await fs.ensureDir(reportsDir);
  const backup = path.join(reportsDir, 'issue-codex-new-theme-directive.md');
  await fs.writeFile(backup, `# ${TITLE}\n\n${body}`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY || '';
  if (!token || !repoFull) {
    console.log('No GitHub token or repository context; saved issue body to reports.');
    return;
  }
  const [owner, repo] = repoFull.split('/');
  const octo = new Octokit({ auth: token });
  await octo.rest.issues.create({ owner, repo, title: TITLE, body, labels: ['codex-improvement','directive','generation'] });
  console.log('Issue created successfully.');
}

main().catch(e => { console.error(e); process.exit(1); });


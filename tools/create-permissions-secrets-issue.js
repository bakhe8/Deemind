#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { Octokit } from 'octokit';

const TITLE = 'codex: permissions & secrets required for full autonomy';

const BODY = `# 🔐 Permissions & Secrets — Full Autonomy Enablement

To enable the Autonomous Theme Factory end-to-end (mock-up → build → validate → release), configure the following:

## GitHub Actions Permissions
- contents: write
- pull-requests: write
- issues: write
- (optional) id-token: write

## Secrets (Repository level)
- SALLA_TOKEN — API token for Salla CLI validate/push/publish
- SALLA_STORE_ID — Optional; target store for push
- LIGHTHOUSE_SERVER_TOKEN — Optional; if using remote LHCI server

## Notes
- Node 20 must be enforced (already set in CI and .nvmrc)
- Auto-merge setup: label \`codex-trivial\` after green CI
- Release governance: label \`release:ready\` to publish from draft

Once configured, re-run the autonomy pipelines (hygiene + harmony + lighthouse).`;

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reportsDir);
  const backup = path.join(reportsDir, 'issue-permissions-secrets.md');
  await fs.writeFile(backup, `# ${TITLE}\n\n${BODY}`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY || '';
  if (!token || !repoFull) {
    console.log('No GitHub token or repository context; saved issue body to reports.');
    return;
  }
  const [owner, repo] = repoFull.split('/');
  const octo = new Octokit({ auth: token });
  await octo.rest.issues.create({ owner, repo, title: TITLE, body: BODY, labels: ['codex-improvement','autonomy','secrets'] });
  console.log('Permissions & secrets issue created.');
}

main().catch(e => { console.error(e); process.exit(1); });


#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';
// import path from 'path';
import { Octokit } from 'octokit';

function latestTag() {
  try {
    execSync('git fetch --tags', { stdio: 'ignore' });
  } catch (e) { /* ignore */ }
  try {
    const tag = execSync('git describe --tags $(git rev-list --tags --max-count=1)', { encoding: 'utf8', shell: '/bin/bash' }).trim();
    return tag || null;
  } catch {
    try { return execSync('git describe --tags', { encoding: 'utf8' }).trim(); } catch { return null; }
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoEnv = process.env.GITHUB_REPOSITORY || '';
  if (!token || !repoEnv.includes('/')) {
    console.error('Missing env: GITHUB_TOKEN and/or GITHUB_REPOSITORY');
    process.exit(1);
  }
  const [owner, repo] = repoEnv.split('/');
  const tag = process.env.RELEASE_TAG || latestTag() || 'v1.0.0';
  const notesCandidates = [
    `reports/release-${tag}.md`,
    'reports/release-v1.0.0.md'
  ];
  let body = `Release ${tag}`;
  for (const p of notesCandidates) {
    if (fs.existsSync(p)) { body = fs.readFileSync(p, 'utf8'); break; }
  }
  const octokit = new Octokit({ auth: token });
  // Check if release exists
  let rel = null;
  try { rel = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag }); } catch { rel = null; }
  if (!rel) {
    const created = await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag, name: tag, body, draft: false, prerelease: false });
    console.log('Created release:', created.data.html_url);
  } else {
    const updated = await octokit.rest.repos.updateRelease({ owner, repo, release_id: rel.data.id, body });
    console.log('Updated release:', updated.data.html_url);
  }
}

main().catch(e => { console.error(e); process.exit(1); });

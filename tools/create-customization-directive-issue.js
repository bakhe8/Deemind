#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { Octokit } from 'octokit';

const TITLE = 'codex: apply customizations to generated Salla theme (Deemind engine)';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIRECTIVE_DOC = path.resolve(
  __dirname,
  '../docs/codex-customization-directive.md',
);

function readDirective() {
  try {
    return fs.readFileSync(DIRECTIVE_DOC, 'utf8');
  } catch (error) {
    console.warn('Unable to read directive markdown:', error.message);
    return '# Codex Customization Directive\n\n(Directive content missing)';
  }
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  await fs.ensureDir(reportsDir);

  const body = readDirective();
  const backup = path.join(reportsDir, 'issue-codex-customization-directive.md');
  await fs.writeFile(backup, `# ${TITLE}\n\n${body}`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY || '';
  if (!token || !repoFull) {
    console.log('No GitHub token or repository context; saved issue body to reports.');
    return;
  }

  const [owner, repo] = repoFull.split('/');
  const octo = new Octokit({ auth: token });
  await octo.rest.issues.create({
    owner,
    repo,
    title: TITLE,
    body,
    labels: ['codex-improvement', 'directive', 'customization'],
  });
  console.log('Issue created successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

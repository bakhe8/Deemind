import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { Octokit } from 'octokit';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

async function readJsonSafe(p, fallback = null) {
  try { return await fs.readJson(p); } catch { return fallback; }
}

async function listThemes(root) {
  if (!(await fs.pathExists(root))) return [];
  const dirs = await fs.readdir(root, { withFileTypes: true });
  return dirs.filter(d => d.isDirectory()).map(d => d.name);
}

async function hasErrors(themeOutDir) {
  const rep = path.join(themeOutDir, 'report-extended.json');
  const r = await readJsonSafe(rep, { summary: { errors: 0 } });
  return (r?.summary?.errors || 0) > 0;
}

function getRepo() {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (envRepo && envRepo.includes('/')) {
    const [owner, repo] = envRepo.split('/');
    return { owner, repo };
  }
  const owner = process.env.OWNER || process.env.DEEMIND_REPO_OWNER;
  const repo = process.env.REPO || process.env.DEEMIND_REPO_NAME;
  return (owner && repo) ? { owner, repo } : null;
}

async function readReport(themeOutDir) {
  const rep = path.join(themeOutDir, 'report-extended.json');
  return readJsonSafe(rep, { errors: [], warnings: [], summary: { errors: 0, warnings: 0 } });
}

function summarizeTypes(arr) {
  const map = new Map();
  for (const it of arr || []) map.set(it.type || 'unknown', (map.get(it.type || 'unknown') || 0) + 1);
  return Object.fromEntries(map);
}

function diffReports(before, after) {
  const bE = summarizeTypes(before.errors);
  const aE = summarizeTypes(after.errors);
  const bW = summarizeTypes(before.warnings);
  const aW = summarizeTypes(after.warnings);
  const allTypes = new Set([...Object.keys(bE), ...Object.keys(aE), ...Object.keys(bW), ...Object.keys(aW)]);
  const delta = [];
  for (const t of allTypes) {
    const be = bE[t] || 0, ae = aE[t] || 0, bw = bW[t] || 0, aw = aW[t] || 0;
    const eDiff = ae - be, wDiff = aw - bw;
    if (eDiff !== 0 || wDiff !== 0) delta.push({ type: t, errors: { before: be, after: ae, delta: eDiff }, warnings: { before: bw, after: aw, delta: wDiff } });
  }
  return { before: { errors: bE, warnings: bW }, after: { errors: aE, warnings: aW }, delta };
}

async function ensureIssue({ octokit, owner, repo, theme, diff, after }) {
  const title = `Doctor: Theme "${theme}" build errors remain`;
  // Find existing issue by title
  const res = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 100 });
  const existing = res.data.find(i => i.title.trim() === title.trim());
  const body = [
    `Doctor run detected remaining errors for theme: ${theme}`,
    '',
    `Summary: errors=${after.summary?.errors||0}, warnings=${after.summary?.warnings||0}`,
    '',
    'Delta by type (errors/warnings):',
    ...diff.delta.map(d => `- ${d.type}: e ${d.errors.before} → ${d.errors.after} (Δ${d.errors.delta}), w ${d.warnings.before} → ${d.warnings.after} (Δ${d.warnings.delta})`),
    '',
    'Artifacts:',
    '- logs/doctor-report.json',
    `- output/${theme}/report-extended.json`
  ].join('\n');
  if (!existing) {
    await octokit.rest.issues.create({ owner, repo, title, body, labels: ['doctor','auto','build-failure'] });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: existing.number, body });
  }
}

async function doctorTheme(theme, { octokit, owner, repo }) {
  const cwd = process.cwd();
  const inputPath = path.join(cwd, 'input', theme);
  const outputPath = path.join(cwd, 'output', theme);
  const beforeRep = await readReport(outputPath);
  const before = (beforeRep?.summary?.errors || 0) > 0;

  try {
    // Attempt quick autofixers
    try {
      const { fixMissingAssets } = await import('./fix-missing-assets.js');
      await fixMissingAssets(theme);
    } catch {}

    try {
      const { normalizeCssAssets } = await import('./normalize-css-assets.js');
      await normalizeCssAssets({ outputPath, inputPath });
    } catch {}

    // Rebuild with autofix flags
    run(`node cli.js ${theme} --sanitize --i18n --autofix`);
  } catch (e) {
    // keep going to gather after-state
    // eslint-disable-next-line no-console
    console.error('Doctor rebuild failed:', e?.message || e);
  }

  const afterRep = await readReport(outputPath);
  const after = (afterRep?.summary?.errors || 0) > 0;
  if (octokit && owner && repo) {
    const diff = diffReports(beforeRep, afterRep);
    if (after) {
      await ensureIssue({ octokit, owner, repo, theme, diff, after: afterRep });
    } else {
      // Close any existing open issue for this theme with all-clear note
      const title = `Doctor: Theme "${theme}" build errors remain`;
      try {
        const res = await octokit.rest.issues.listForRepo({ owner, repo, state: 'open', per_page: 100 });
        const existing = res.data.find(i => i.title.trim() === title.trim());
        if (existing) {
          await octokit.rest.issues.createComment({ owner, repo, issue_number: existing.number, body: '✅ All clear — doctor fixed remaining errors.' });
          await octokit.rest.issues.update({ owner, repo, issue_number: existing.number, state: 'closed' });
        }
      } catch {}
    }
  }
  return { theme, before, after };
}

async function main() {
  const outRoot = path.join(process.cwd(), 'output');
  const themes = await listThemes(outRoot);
  const results = [];
  let octokit = null, owner = null, repo = null;
  try {
    const token = process.env.GITHUB_TOKEN || process.env.TOKEN;
    const repoInfo = getRepo();
    if (token && repoInfo) { octokit = new Octokit({ auth: token }); owner = repoInfo.owner; repo = repoInfo.repo; }
  } catch {}
  for (const t of themes) {
    const themeOut = path.join(outRoot, t);
    if (!(await hasErrors(themeOut))) continue; // skip healthy
    const res = await doctorTheme(t, { octokit, owner, repo });
    results.push(res);
  }
  await fs.ensureDir('logs');
  await fs.writeJson(path.join('logs', 'doctor-report.json'), { ranAt: new Date().toISOString(), results }, { spaces: 2 });
  const remaining = results.filter(r => r.after).map(r => r.theme);
  if (remaining.length) {
    console.error('Doctor could not fully fix themes:', remaining.join(', '));
    process.exitCode = 1; // let CI surface remaining issues
  } else {
    console.log('Doctor finished.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

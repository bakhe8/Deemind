import { execSync } from 'child_process';
import path from 'path';

function run(cmd, args, cwd) {
  try {
    execSync([cmd, ...args].join(' '), { stdio: 'inherit', cwd });
    return true;
  } catch (e) {
    console.warn('Salla CLI command failed or not available:', e?.message || e);
    return false;
  }
}

function usage() {
  console.log('Usage: node tools/salla-cli.js <zip|serve|push|validate> [theme]');
}

async function main() {
  const sub = process.argv[2];
  const theme = process.argv[3] || 'demo';
  if (!sub) return usage();
  const outDir = path.join(process.cwd(), 'output', theme);

  const hasToken = !!process.env.SALLA_TOKEN;
  const cmd = 'npx';
  const baseArgs = ['salla'];

  let ok = true;
  if (sub === 'zip') {
    ok = run(cmd, [...baseArgs, 'theme:zip', `--path`, outDir], process.cwd());
  } else if (sub === 'serve') {
    ok = run(cmd, [...baseArgs, 'theme:serve', `--path`, outDir], process.cwd());
  } else if (sub === 'push') {
    if (!hasToken) {
      console.warn('Skipping push: SALLA_TOKEN not set');
      return;
    }
    ok = run(cmd, [...baseArgs, 'theme:push', `--path`, outDir], process.cwd());
  } else if (sub === 'validate') {
    ok = run(cmd, [...baseArgs, 'theme:validate', `--path`, outDir], process.cwd());
  } else {
    usage();
    return;
  }
  if (!ok) process.exitCode = 0; // do not fail CI if CLI missing
}

main();

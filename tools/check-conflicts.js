import { execSync } from 'child_process';
import fs from 'fs';

function listTrackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  return out.filter(f => !f.startsWith('node_modules/') && !f.startsWith('output/') && !f.startsWith('archives/') && !f.startsWith('.git/'));
}

let found = [];
for (const file of listTrackedFiles()) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    if (/^[<]{7}|^[>]{7}|^={7}/m.test(txt)) found.push(file);
  } catch (e) { /* ignore unreadable file */ void e; }
}

if (found.length) {
  console.error('❌ Conflict markers detected in files:', found.join(', '));
  process.exit(1);
}
console.log('✅ No conflict markers found.');

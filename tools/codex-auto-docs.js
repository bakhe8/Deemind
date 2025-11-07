/**
 * Codex Auto-Docs Generator
 * Scans workflows, tools, and core modules to generate useful Markdown docs.
 * - Generates docs/workflows.md (triggers, jobs, steps, artifacts, secrets)
 * - Generates docs/modules.md (purpose, main functions, inputs/outputs)
 * - Updates README.md with a 📚 Documentation Index linking all docs/*.md
 * Uses OPENAI_API_KEY optionally to enhance summaries; otherwise, derives from code.
 */
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import YAML from 'yaml';

function read(p){ try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function write(p, s){ fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
function listDocs(){ return globSync('docs/**/*.md', { nodir: true }).sort(); }

function parseWorkflows(){
  const files = globSync('.github/workflows/*.{yml,yaml}', { nodir: true });
  const out = [];
  for (const f of files){
    const raw = read(f);
    let y; try { y = YAML.parse(raw); } catch { y = null; }
    const name = (y && y.name) || path.basename(f);
    const triggers = [];
    if (y && y.on){
      if (Array.isArray(y.on)) triggers.push(...y.on);
      else if (typeof y.on === 'object') triggers.push(...Object.keys(y.on));
      else triggers.push(String(y.on));
    }
    const jobs = [];
    if (y && y.jobs){
      for (const [jid, j] of Object.entries(y.jobs)){
        const steps = (j.steps || []).map(s => s.name || s.uses || s.run || 'step');
        jobs.push({ id: jid, runs_on: j['runs-on'] || j.runs_on, steps });
      }
    }
    const artifacts = (raw.match(/upload-artifact@|upload-pages-artifact@/g) || []).length > 0;
    const pages = /deploy-pages@|configure-pages@/i.test(raw);
    const secrets = Array.from(new Set(Array.from(raw.matchAll(/secrets\.([A-Z0-9_]+)/g)).map(m => m[1])));
    out.push({ file: f, name, triggers, jobs, artifacts, pages, secrets });
  }
  return out;
}

function summarizeJs(p){
  const raw = read(p);
  const hdr = (raw.match(/\/\*\*[\s\S]*?\*\//) || [null])[0] || '';
  const exports = Array.from(raw.matchAll(/export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g)).map(m => m[1]);
  const imports = Array.from(raw.matchAll(/from\s+['"]([^'"]+)['"]/g)).map(m => m[1]);
  return { header: hdr.trim(), exports, imports };
}

function parseModules(){
  const files = [ 'cli.js', ...globSync('tools/**/*.js', { nodir: true }) ];
  const out = [];
  for (const f of files){
    if (f.includes('node_modules')) continue;
    const info = summarizeJs(f);
    out.push({ file: f, ...info });
  }
  return out;
}

function genWorkflowsMd(wfs){
  const lines = ['# Workflows', ''];
  for (const w of wfs){
    lines.push(`## ${w.name}`);
    lines.push(`- File: ${w.file}`);
    lines.push(`- Triggers: ${w.triggers.length ? w.triggers.join(', ') : 'n/a'}`);
    lines.push(`- Artifacts: ${w.artifacts ? 'yes' : 'no'}${w.pages ? ' (pages)' : ''}`);
    lines.push(`- Secrets: ${w.secrets.length ? w.secrets.join(', ') : 'none'}`);
    lines.push('- Jobs:');
    for (const j of w.jobs){
      lines.push(`  - ${j.id} (runs-on: ${j.runs_on || 'default'})`);
      const stepList = j.steps.slice(0, 12).map(s => `    • ${String(s).split('\n')[0].slice(0,120)}`);
      lines.push(...stepList);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function genModulesMd(mods){
  const lines = ['# Modules', ''];
  for (const m of mods){
    lines.push(`## ${m.file}`);
    if (m.header) lines.push(m.header);
    if (m.exports && m.exports.length) lines.push(`- Exports: ${m.exports.join(', ')}`);
    if (m.imports && m.imports.length) lines.push(`- Imports: ${Array.from(new Set(m.imports)).slice(0, 10).join(', ')}${m.imports.length>10?' …':''}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function updateReadmeIndex(){
  const readmePath = path.resolve('README.md');
  let readme = read(readmePath);
  const docs = listDocs();
  const items = docs.map(p => `- [${path.basename(p)}](${p})`).join('\n');
  const section = `\n## 📚 Documentation Index\n\n${items}\n`;
  if (/## 📚 Documentation Index[\s\S]*?(?=\n## |$)/.test(readme)){
    readme = readme.replace(/## 📚 Documentation Index[\s\S]*?(?=\n## |$)/, section);
  } else {
    readme += section;
  }
  write(readmePath, readme);
}

async function main(){
  const workflows = parseWorkflows();
  const modules = parseModules();
  write(path.resolve('docs','workflows.md'), genWorkflowsMd(workflows));
  write(path.resolve('docs','modules.md'), genModulesMd(modules));
  // Optional: Enhanced narratives via OpenAI if key is present
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const wfText = genWorkflowsMd(workflows);
      const modText = genModulesMd(modules);
      const repoOverview = read('README.md');
      const prompt = [
        'You are Codex. Produce concise but thorough technical documentation for this repository.',
        'Audience: senior engineers. Tone: precise, actionable. No placeholders.',
        'Include: architecture overview, parser/mapper/adapter/validator responsibilities, CI/CD summary, workflows, and maintenance loops.',
        'Base your writing strictly on the provided extracted content; synthesize where helpful.',
        '--- README (context) ---',
        repoOverview.slice(0, 12000),
        '--- Workflows (extracted) ---',
        wfText.slice(0, 12000),
        '--- Modules (extracted) ---',
        modText.slice(0, 12000)
      ].join('\n');
      const resp = await client.responses.create({ model: 'gpt-4.1-mini', input: prompt });
      const enhanced = String(resp.output_text || '').trim();
      if (enhanced) write(path.resolve('docs','architecture-enhanced.md'), enhanced + '\n');
    } catch (e) {
      // If enhancement fails, proceed with extracted docs only
       
      console.warn('AI enhancement skipped:', e.message || e);
    }
  }
  updateReadmeIndex();
  console.log('Auto-docs generated.');
}

main().catch(e => { console.error('codex-auto-docs error:', e); process.exit(1); });


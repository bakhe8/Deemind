/**
 * Codex Auto-Evaluation Entrypoint
 * - Reads latest validation log and ESLint JSON
 * - Calls OpenAI to propose improvements
 * - Writes suggestions and a human-readable summary under /reports
 */
import fs from 'fs';
import path from 'path';

async function main() {
  const reportsDir = path.resolve('reports');
  const logsDir = path.resolve('logs');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

  const valLogPath = path.join(logsDir, 'deemind_validation.log');
  const eslintPath = path.join(logsDir, 'eslint.json');
  const valLog = fs.existsSync(valLogPath) ? fs.readFileSync(valLogPath, 'utf8') : 'NO_VALIDATION_LOG';
  const eslintJson = fs.existsSync(eslintPath) ? fs.readFileSync(eslintPath, 'utf8') : '[]';

  const date = new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const stamp = `${y}${m}${d}`;

  const suggestionsPath = path.join('logs', 'codex_suggestions.json');
  const summaryPath = path.join('reports', `codex-summary-${stamp}.md`);
  const exportedSuggestions = path.join('reports', `codex-suggestions-${stamp}.json`);
  const diffPath = path.join('reports', `codex-diff-${stamp}.patch`);

  let outputText = '';
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('Missing OPENAI_API_KEY');
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });
    const prompt = [
      'You are Codex. Evaluate the following Deemind build logs and ESLint JSON.',
      'Suggest concrete, code-level improvements (security, performance, scalability, maintainability).',
      'Respond in strictly JSON array form, each item:',
      '{ "file": "...", "issue": "...", "fix": "...", "auto_apply": true|false }',
      '',
      '=== Validation Log (tail) ===',
      valLog.slice(-15000),
      '',
      '=== ESLint JSON ===',
      eslintJson.slice(0, 15000)
    ].join('\n');

    const res = await client.responses.create({
      model: 'gpt-4.1-code',
      input: prompt
    });
    outputText = String(res.output_text || '').trim();
  } catch (e) {
    // Fallback: empty suggestions
    outputText = '[]';
  }

  // Write suggestions to logs and reports
  fs.writeFileSync(suggestionsPath, outputText + '\n', 'utf8');
  fs.writeFileSync(exportedSuggestions, outputText + '\n', 'utf8');

  // Basic summary
  const items = safeParse(outputText);
  const counts = {
    total: Array.isArray(items) ? items.length : 0,
    auto: Array.isArray(items) ? items.filter(x => x && x.auto_apply).length : 0
  };
  const md = [
    `## 🧠 Deemind Auto-Evaluation — ${y}-${m}-${d}`,
    `- Suggestions: ${counts.total} (auto-apply: ${counts.auto})`,
    `- Validation log: ${valLogPath}`,
    `- ESLint report: ${eslintPath}`,
    '',
    '### Top Suggestions',
    ...(Array.isArray(items) ? items.slice(0, 10).map((s, i) => `- ${i + 1}. ${s.file}: ${s.issue}`) : ['- No suggestions'])
  ].join('\n');
  fs.writeFileSync(summaryPath, md + '\n', 'utf8');

  // Placeholder diff patch (future: generate actual patch set)
  if (!fs.existsSync(diffPath)) fs.writeFileSync(diffPath, '', 'utf8');

  console.log('🧠 Codex evaluation complete — suggestions written to', suggestionsPath);
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

main().catch(e => { console.error('Codex auto-eval error:', e); process.exit(0); });


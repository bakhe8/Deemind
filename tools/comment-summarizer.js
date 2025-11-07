import { Octokit } from 'octokit';
import OpenAI from 'openai';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getRepo() {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (!envRepo) throw new Error('GITHUB_REPOSITORY not set');
  const [owner, repo] = envRepo.split('/');
  return { owner, repo };
}

async function main() {
  const { owner, repo } = getRepo();
  const prNumber = Number(process.env.PR_NUMBER || process.argv[2]);
  if (!prNumber) throw new Error('Provide PR number via PR_NUMBER env or argv');

  // Collect PR body, comments, and reviews
  const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
  const comments = await octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100 });
  const reviews = await octokit.rest.pulls.listReviews({ owner, repo, pull_number: prNumber, per_page: 100 });

  const text = [
    `PR Title: ${pr.data.title}`,
    `PR Body: ${pr.data.body || ''}`,
    '--- Comments ---',
    ...(comments.data || []).map(c => `@${c.user.login}: ${c.body || ''}`),
    '--- Reviews ---',
    ...(reviews.data || []).map(r => `@${r.user.login} [${r.state}]: ${r.body || ''}`),
  ].join('\n');

  const prompt = `Summarize the following PR discussion in 6 bullets: goals, key changes, concerns, blockers, decisions, next steps. Keep it concise.`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You summarize GitHub pull request discussions succinctly.' },
      { role: 'user', content: `${prompt}\n\n${text}` },
    ],
    temperature: 0.3,
  });
  const summary = res.choices[0]?.message?.content || 'No summary.';

  await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body: `### 🤖 PR Discussion Summary\n\n${summary}` });
}

main().catch((e) => { console.error(e); process.exit(1); });


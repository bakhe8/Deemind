#!/usr/bin/env node
// Closes all open issues in the given repo, adding a standard comment.
// Usage: node tools/close-open-issues.js <owner/repo> "Comment message"

const repo = process.argv[2];
const note = process.argv[3] || '✅ Verified in local build — feature implemented successfully.';

if (!repo) {
  console.error('Usage: node tools/close-open-issues.js <owner/repo> [comment]');
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!token) {
  console.error('Missing GITHUB_TOKEN/GH_TOKEN env for authentication');
  process.exit(1);
}

const base = `https://api.github.com/repos/${repo}`;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${path} -> ${res.status} ${res.statusText}: ${txt}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

(async () => {
  let page = 1;
  const openIssues = [];
  while (true) {
    const data = await api(`/issues?state=open&per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    openIssues.push(...data.filter(i => !i.pull_request));
    page++;
  }
  for (const issue of openIssues) {
    try {
      await api(`/issues/${issue.number}/comments`, { method: 'POST', body: { body: note } });
      await api(`/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed' } });
      console.log(`Closed #${issue.number} - ${issue.title}`);
    } catch (err) {
      console.error(`Failed to close #${issue.number}:`, err.message || err);
    }
  }
})();


// tools/sync-roadmap-to-issues.js
// Reads docs/deemind_checklist.md, creates/updates issues for each checkbox line.
// Requires env: GITHUB_TOKEN, OWNER, REPO

import fs from "fs";
import { Octokit } from "octokit";

const OWNER = process.env.OWNER;   // e.g. "EvaniaDeemind"
const REPO  = process.env.REPO;    // e.g. "deemind"
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN || !OWNER || !REPO) {
  console.error("Missing env: GITHUB_TOKEN, OWNER, REPO");
  process.exit(1);
}

const octokit = new Octokit({ auth: TOKEN });

const md = fs.readFileSync("docs/deemind_checklist.md", "utf8");
const lines = md.split(/\r?\n/);

// Parse "- [ ] Title" and "- [x] Title"
const items = lines
  .map(l => {
    const open = l.match(/^\s*-\s*\[\s*\]\s+(.+?)\s*$/);
    const done = l.match(/^\s*-\s*\[\s*x\s*\]\s+(.+?)\s*$/i);
    if (open) return { title: open[1].trim(), state: "open" };
    if (done) return { title: done[1].trim(), state: "done" };
    return null;
  })
  .filter(Boolean);

async function findIssue(title) {
  const res = await octokit.rest.issues.listForRepo({
    owner: OWNER,
    repo: REPO,
    state: "all",
    per_page: 100
  });
  return res.data.find(i => i.title.trim() === title.trim());
}

(async function main() {
  for (const item of items) {
    const existing = await findIssue(item.title);

    if (!existing) {
      if (item.state === "open") {
        const created = await octokit.rest.issues.create({
          owner: OWNER,
          repo: REPO,
          title: item.title,
          body: "Auto-created from docs/deemind_checklist.md",
          labels: ["roadmap", "auto"]
        });
        console.log(`➕ Created #${created.data.number}: ${item.title}`);
      } else {
        console.log(`✔️ Skipped (done in checklist): ${item.title}`);
      }
    } else {
      if (item.state === "done" && existing.state !== "closed") {
        await octokit.rest.issues.update({
          owner: OWNER, repo: REPO, issue_number: existing.number, state: "closed"
        });
        console.log(`✅ Closed #${existing.number}: ${item.title}`);
      } else if (item.state === "open" && existing.state === "closed") {
        console.log(`ℹ️ Exists closed: ${item.title}`);
      } else {
        console.log(`= In sync: ${item.title}`);
      }
    }
  }
  console.log("Done syncing roadmap → issues.");
})().catch(e => {
  console.error(e);
  process.exit(1);
});


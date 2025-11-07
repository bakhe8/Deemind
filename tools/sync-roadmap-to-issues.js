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
const graphql = octokit.graphql;

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
  const projectId = await resolveProjectId();
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
        if (projectId) await addToProject(projectId, created.data.node_id, created.data.number);
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
      // Ensure linked in project
      if (projectId) await addToProject(projectId, existing.node_id, existing.number);
    }
  }
  console.log("Done syncing roadmap → issues.");
})().catch(e => {
  console.error(e);
  process.exit(1);
});

async function resolveProjectId() {
  // If PROJECT_ID provided, use it
  const direct = process.env.PROJECT_ID;
  if (direct) return direct;
  const ownerLogin = process.env.PROJECT_OWNER || OWNER;
  const ownerType = (process.env.PROJECT_OWNER_TYPE || 'USER').toUpperCase(); // USER or ORG
  const number = process.env.PROJECT_NUMBER ? Number(process.env.PROJECT_NUMBER) : null;
  const title = process.env.PROJECT_TITLE || null;
  try {
    if (number) {
      if (ownerType === 'ORG') {
        const data = await graphql(
          `query($login:String!,$number:Int!){ org(login:$login){ projectV2(number:$number){ id title number } } }`,
          { login: ownerLogin }
        );
        return data?.org?.projectV2?.id || null;
      }
      const data = await graphql(
        `query($login:String!,$number:Int!){ user(login:$login){ projectV2(number:$number){ id title number } } }`,
        { login: ownerLogin }
      );
      return data?.user?.projectV2?.id || null;
    }
    if (title) {
      if (ownerType === 'ORG') {
        const data = await graphql(
          `query($login:String!){ org(login:$login){ projectsV2(first:50){ nodes{ id title number } } } }`,
          { login: ownerLogin }
        );
        const match = (data?.org?.projectsV2?.nodes || []).find(p => p.title === title);
        return match?.id || null;
      }
      const data = await graphql(
        `query($login:String!){ user(login:$login){ projectsV2(first:50){ nodes{ id title number } } } }`,
        { login: ownerLogin }
      );
      const match = (data?.user?.projectsV2?.nodes || []).find(p => p.title === title);
      return match?.id || null;
    }
  } catch (e) {
    console.warn('Project lookup failed:', e?.message || e);
  }
  return null;
}

async function addToProject(projectId, issueNodeId, issueNumber) {
  try {
    await graphql(
      `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId, contentId:$contentId}){ item { id } } }`,
      { projectId, contentId: issueNodeId }
    );
    console.log(`📌 Added #${issueNumber} to project`);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('already exists') || msg.includes('content id already in the project')) {
      console.log(`= Already in project: #${issueNumber}`);
      return;
    }
    console.warn(`⚠️ Project add failed for #${issueNumber}:`, msg);
  }
}

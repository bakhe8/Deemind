# Codex Requirements

What Codex needs to improve execution effectiveness:

- OPENAI_API_KEY (for enriched summaries, optional)
- GITHUB_TOKEN with contents:write, pull-requests:write (for auto-PRs and merges)
- LIGHTHOUSE_URL_DEMO/LIGHTHOUSE_URL_GIMNI secrets for Lighthouse CI
- Access to Salla schema registry or canonical reference to detect schema drift
- Stable preview or staging environment for theme audits
- Permission to enforce madge cycle gate (fail builds on cycles)
- Ability to run weekly depcheck and open cleanup PRs

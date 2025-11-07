# Codex Restructure Summary

## Actions

- Enforced Node 20 (engines 20.x, .nvmrc=20)
- Restricted workflows to main pushes
- Added static analysis (madge/depcheck) with CI step
- Enhanced Salla compliance: theme.json enriched; CLI validate step added
- Agent locked to main via configs/agent.json; trivial PR labelling
- Added docs: DEEMIND_STABLE.md and Tools.md

## Next

- Optional Lighthouse CI against preview
- Reduce ESLint warnings
- Expand snapshot fixtures

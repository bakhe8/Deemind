# Developer Workflow

- Branch model: main (production), develop (integration), feature/_, hotfix/_
- Open PRs to develop; require CI + review; squash & merge.
- Pre-commit: lint-staged, fixtures, validator.
- CI: build demo + fixtures; lint workflow on PRs.
- Release: release drafter prepares notes; publish on merge to main.

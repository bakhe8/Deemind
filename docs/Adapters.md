# Adapters — Salla Alignment

This document explains how Deemind aligns theme structure and tooling with Salla’s official standards.

References:

- Salla Theming Docs: https://salla.dev/docs/themes/
- Salla CLI: https://salla.dev/docs/themes/cli

What we generate

- Directories: `layout/`, `pages/`, `partials/`, `assets/` under `output/<theme>/`.
- Twig: `pages/*.twig` extend `layout/default.twig`.
- Metadata: `manifest.json` (engine build stats) and `theme.json` (Salla-compatible metadata).

theme.json fields

- `name` / `display_name`: theme folder name.
- `version`: mirrors manifest version.
- `engine`: `twig`.
- `layout`: `layout/default.twig`.
- `author`, `license`: set by CLI, editable.

Baseline-driven partials

- Adapter can map shared sections to partials using a baseline (e.g., Raed). See `configs/baselines/` and `tools/adapter.js`.
- Rewrites are recorded to `output/<theme>/reports/baseline-rewrites.json`.

Validator rules

- Extended validator checks structure, i18n wrapping, budgets, assets, baseline conventions, SDK/web-components usage.
- It accepts `{% trans %}`, `{{ 'text' | t }}` and interpolation (e.g., `{{ 'Welcome %value%' | t({'%value%': product.name}) }}`).

Salla CLI integration

- Wrapper: `tools/salla-cli.js` runs `npx salla theme:zip|serve|push --path output/<theme>`.
- Env: `SALLA_TOKEN` required for `push`.
- Scripts:
  - `npm run salla:zip -- demo`
  - `npm run salla:serve -- demo`
  - `npm run salla:push -- demo`

CI/CD

- Workflow `.github/workflows/salla-validate.yml` builds `demo`, lints CSS, runs PostCSS, and packages with Salla CLI if available.
- Use repository secret `SALLA_TOKEN` to enable authenticated actions.

PostCSS & Stylelint

- PostCSS plugins: `postcss-dir-pseudo-class`, `autoprefixer`.
- Script `npm run postcss:process -- <theme>` processes `output/<theme>/assets/*.css`.
- Stylelint config `.stylelintrc.json` enforces standard CSS rules (ignores minified outputs).

Updating Salla baseline or schema

- Update `configs/salla-schema.json` or add canonical copies under `configs/canonical/salla/`.
- Run validators: `npm run deemind:validate` or CI.
- Rebuild themes and refresh snapshots if intended structural changes occur.

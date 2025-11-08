# Baseline-Driven Alignment (Raed)

Deemind can align its output to a known-good Salla theme baseline using metadata extracted from Salla’s public theme "Raed". Only structural patterns are used (includes, extends, block names, variables) — no template code is copied.

## Import / Update the Baseline

- Clone/update Raed and extract patterns:

```
npm run baseline:import:raed
```

Outputs are written to:

- `configs/baselines/raed/graph.json` — files → includes/extends/blocks/vars/i18n
- `configs/baselines/raed/summary.json` — top includes/blocks/vars counts
- `configs/baselines/raed/conventions.json` — conventional dirs

## Use the Baseline During Build

Enable baseline-aware rewriting _and_ gap filling with Raed assets:

```
npm run deemind:build <theme> -- --baseline=raed --partialize --sanitize --i18n
```

New behaviour:

1. **Primary source = your input**: everything inside `input/<theme>/` is still parsed first and always wins.
2. **Automatic completion**: immediately after adapting, Deemind copies any missing layouts, pages, components, locales, or assets from `.baselines/<baselineName>/` into the output. Only missing files are copied; anything you supplied stays untouched.
3. **Baseline strategies**:
   - `--baseline-mode=fill` → only create missing files.
   - `--baseline-mode=enrich` (default) → create missing files _and_ supplement “thin” outputs by appending Raed sections or merging JSON keys.
   - `--baseline-mode=force` → override existing files with the baseline version (use sparingly).
     Set via CLI or `DEEMIND_BASELINE_MODE`.
4. **Logging**: every run writes structured JSON under `logs/baseline/<theme>-<timestamp>.json` listing added/enriched/forced files.
5. **Diff mode**: add `--diff` to generate `output/<theme>/reports/baseline-diff.md` (added/skipped lists, histograms).
6. **Manifest**: each run writes/updates `output/<theme>/reports/baseline-summary.json` listing patched files, baseline commit, and stats for validator use.

## Validator Warnings (Non-Fatal)

The extended validator reads `configs/baselines/raed/*` and surfaces warn-only conventions:

- Missing conventional directories (`layout/`, `pages/`, `partials/`, `assets/`).
- Pages that don’t extend a layout.
- Includes that don’t use `partials/…` paths.
- Coarse i18n coverage gap against the baseline.

These appear under the `baseline_convention` group in `report-extended.json` and won’t fail the build.

### Selecting / Chaining Baselines

- CLI flag: `npm run deemind:build foo -- --baseline=my-theme,theme-raed`
- `baseline.config.json` in your theme root can disable specific groups or specify `"fallbackTheme": "theme-raed"` (automatically queued if the first baseline runs out).
- Environment: set `DEEMIND_BASELINE=<folderA,folderB>` or `DEEMIND_BASELINE_ROOT=/absolute/path`.
- Default: `theme-raed` (reads from `.baselines/theme-raed`).

Example `baseline.config.json` (place in `input/<theme>/` or the baseline repo):

```json
{
  "useLayouts": true,
  "usePages": true,
  "useComponents": false,
  "useLocales": true,
  "useAssets": true,
  "fallbackTheme": "theme-raed"
}
```

### Diff / Audit Workflow

- `--diff` → generates `output/<theme>/reports/baseline-diff.md` plus the JSON log in `logs/baseline/`.
- Inspect manifest:

  ```bash
  node -e "console.log(require('./output/demo/reports/baseline-summary.json'))"
  ```

- Compare against baseline source:

  ```bash
  git --no-pager diff --no-index .baselines/theme-raed/src/views layout
  ```

### Interactive / CI Modes

- Prompted fills: by default the CLI asks once per baseline if files should be copied (when running in an interactive terminal).
- Use `--auto` (or run inside CI) to auto-approve fills without prompts.
- `--diff` can be combined with `--auto`.

### Opt-Outs

- Skip completion entirely: omit `--baseline` and unset `DEEMIND_BASELINE*`.
- Disable specific groups via `baseline.config.json`.
- Delete `output/<theme>/reports/baseline-summary.json` to force the validator to treat all files as user-authored.

## Baseline Health & Metrics

- `npm run validate:baseline` — ensures each `.baselines/<name>` repo has the expected folders, no circular Twig inheritance, and produces `reports/baseline-integrity.json`.
- Every build appends a row to `reports/baseline-metrics.md` (theme, added/skipped counts, duration, validator errors/warnings) for dashboards/CI.

## References

- Salla theme docs: layout/pages/components structure, translation filters (`| t`, `{% trans %}`), Twig conventions.
- Raed public repo used only for structural metadata + fallback assets served from `.baselines/theme-raed`.

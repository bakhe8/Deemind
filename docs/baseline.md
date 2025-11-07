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

Enable baseline-aware partial naming and include rewriting:

```
npm run deemind:build <theme> -- --baseline=raed --partialize --sanitize --i18n
```

What happens:

- Partial names become deterministic and grouped (e.g., `partials/home/<slug>.twig`).
- A rewrites report is saved to `output/<theme>/reports/baseline-rewrites.json`.
- Adapter preserves layout/pages/partials order and favours `partials/…` includes.

## Validator Warnings (Non-Fatal)

The extended validator reads `configs/baselines/raed/*` and surfaces warn-only conventions:

- Missing conventional directories (`layout/`, `pages/`, `partials/`, `assets/`).
- Pages that don’t extend a layout.
- Includes that don’t use `partials/…` paths.
- Coarse i18n coverage gap against the baseline.

These appear under the `baseline_convention` group in `report-extended.json` and won’t fail the build.

## Opt-Outs

- Disable alignment: omit `--baseline=raed`.
- Per-run: `--no-baseline` (planned) or keep `--baseline` off.
- Note: alignment uses heuristics based on classes/signatures for grouping.

## References

- Salla theme docs: layout/pages/components structure, translation filters (`| t`, `{% trans %}`), and Twig conventions.
- Raed public repo used only for structural metadata.

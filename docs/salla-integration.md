# Salla Docs Integration

Deemind can ingest public Salla documentation to enhance alignment during build and validation.

## Sync Hints From Docs

Run the harvester to fetch and summarize key hints (layout hooks, helpers, filters, component categories):

```
npm run salla:docs:sync
```

It writes `configs/knowledge/salla-docs.json` with fields:

- `layouts.masterHooks`: list of suggested master layout block names (e.g., head, header, content, footer, scripts)
- `helpers`: occurrences of `salla.*` helpers found
- `filters`: Twig filters seen (e.g., `t`, `escape`, `raw`)
- `components.{home,header,footer,products}`: headings found under these sections

The scraper is heuristic and safe; when pages are unreachable it falls back to sane defaults.

## How It’s Used

- Adapter: when generating `layout/default.twig`, it will include master blocks discovered in `salla-docs.json`.
- Validator (extended): warns when pages don’t extend a layout; when includes aren’t under `partials/`; and when overall i18n coverage is far below the baseline.

## Updating

Re-run `npm run salla:docs:sync` whenever Salla docs change to refresh the hints.

# Salla JS Web Components (Hints)

Deemind can harvest Salla docs for custom element tags (e.g., `<salla-*>`) and surface warn-only hints.

## Update Knowledge

- Run: `npm run salla:docs:sync`
- Stores tags in `configs/knowledge/salla-docs.json` under `webComponents.tags`

## Validator Hints

- Warns about unknown `<salla-*>` tags not present in harvested knowledge.
- Does not fail builds; informational guidance only.

## Notes

- The harvester relies on docs content; if pages change, re-run the sync.
- Adapter ensures a `{% block scripts %}` exists in the layout for any component scripts.

# Salla SDK Integration (Hints)

Deemind can harvest public Salla docs to learn SDK API identifiers and surface warn‑only guidance.

## Update SDK Knowledge

- Run: `npm run salla:docs:sync`
- Stores: `configs/knowledge/salla-docs.json`
  - `sdk.apis`: identifiers like `salla.cart.addItem`, `salla.event.on`
  - `sdk.deprecated`: optional list if detected

## How It’s Used

- Validator (extended) scans built Twig and JS for `salla.*`, `Salla.*`, or `SDK.*`:
  - Warns on unknown APIs not found in `sdk.apis`
  - Warns on deprecated APIs if listed
- Adapter ensures the master layout exposes a `{% block scripts %}` block so SDK usage can be placed there.

## Notes

- This is heuristic and warn‑only: it never fails builds.
- Re‑run sync when Salla updates docs to refresh hints.

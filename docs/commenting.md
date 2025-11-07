# Deemind Commenting Guide

Principles used across the codebase:

- Explain the why, not the what: comments clarify design intent, trade‑offs, and constraints; code and names should cover the what/how.
- Be concise and clear: prefer short, direct notes over narratives. Refactor code if a comment grows too long.
- Avoid redundancy: comments add context that is non‑obvious from reading the code.
- Keep comments current: update or remove comments whenever behavior changes.
- Clarify complex logic: add brief notes where algorithms or heuristics could surprise a reader later.
- Document assumptions/constraints: e.g., timeouts, budgets, path guards, and default sanitize behavior.
- Use standardized formats: exported functions use JSDoc blocks for purpose and rationale.
- Add comments during bug fixes: note cause and fix intent briefly for future maintainers.
- Provide external references: link docs/specs if behavior follows an external standard.
- Use comments sparingly: self‑documenting code remains the primary goal.


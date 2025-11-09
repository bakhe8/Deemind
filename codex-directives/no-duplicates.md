# Codex Directive: Prevent Function Duplication

Before writing any new function, class, or module:

1. Read `/core/manifest/functions-index.json` to see if the function or behavior already exists.
2. Search `/core`, `/tools`, `/service`, and `/dashboard/lib` for similar names or logic.
3. If an existing helper is found, import or extend it instead of redefining it.
4. If no helper exists, document the reason in the file header comment and register the new function in `/core/manifest/functions-index.json`.
5. Run `npm run codex:check-duplicates` before opening a PR to ensure no collisions remain.

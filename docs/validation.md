# Validation

Core validator (tools/validator.js):
- Ensures required directories exist (layout, pages)
- Counts pages and writes report.json

Extended validator (tools/validator-extended.js):
- Optionally reads budgets and schema
- Writes report-extended.json with warnings/errors

Future checks:
- Asset encoding and path safety
- Twig syntax sanity
- Required Salla template presence


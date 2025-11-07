# Deemind Architecture

Deemind converts static HTML prototypes into Salla-ready themes using a 3-zone flow:

- Input: parse + normalize (conflicts, structure)
- Conversion: semantic mapping + dependency-aware adaptation
- Output: validation, manifest, (optional) archive

Core modules:
- tools/deemind-parser/parser.js
- tools/deemind-parser/semantic-mapper.js
- tools/adapter-salla.js
- tools/validator.js (with build manifest)

Design principles:
- Single command pipeline
- Deterministic input/output folders
- Offline-first (schemas optional)
- Clear CLI summaries and reports


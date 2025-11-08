# Architecture Graph

## Edges (importer → imported)
- cli.js → tools/adapter.js
- cli.js → tools/baseline-compare.js
- cli.js → tools/deemind-parser/hybrid-runner.js
- cli.js → tools/deemind-parser/semantic-mapper.js
- cli.js → tools/partials-prune.js
- cli.js → tools/validator-extended.js
- cli.js → tools/validator.js
- tools/adapter-salla.js → tools/adapter.js
- tools/deemind-parser/hybrid-runner.js → tools/deemind-parser/conflict-detector.js
- tools/deemind-parser/hybrid-runner.js → tools/deemind-parser/css-parser.js
- tools/deemind-parser/hybrid-runner.js → tools/deemind-parser/js-extractor.js
- tools/deemind-parser/hybrid-runner.js → tools/deemind-parser/parser.js
- tools/fix-i18n-output.js → configs/constants.js

Nodes: 68
Edges: 13
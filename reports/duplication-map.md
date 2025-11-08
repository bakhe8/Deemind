# Duplication Map

## Identical Files

## Duplicate Function Implementations

## Resolutions Applied
- tools/adapter-salla.js is now a thin wrapper re-exporting adaptToSalla from tools/adapter.js to avoid drift and duplication. All consumers should import from tools/adapter.js.

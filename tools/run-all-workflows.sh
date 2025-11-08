#!/usr/bin/env bash
set -euo pipefail

workflows=(
  "codex-agent.yml"
  "codex-auto-eval.yml"
  "code-hygiene.yml"
  "lighthouse.yml"
)

for wf in "${workflows[@]}"; do
  echo "Triggering $wf ..."
  gh workflow run "$wf" --ref main
done

echo "✅ All workflows queued."

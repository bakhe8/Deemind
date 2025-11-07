#!/usr/bin/env bash

# Create milestones, labels, and issues from .github/deemind-issues.json
# Requires: GitHub CLI (gh) authenticated, and jq installed
# Usage: ./tools/gh-create-issues.sh <owner/repo> [path-to-json]

set -euo pipefail

REPO=${1:-}
JSON_FILE=${2:-.github/deemind-issues.json}

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [json]" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh (GitHub CLI) not found. Install and run 'gh auth login'." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq not found. Please install jq." >&2
  exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
  echo "Error: JSON file not found: $JSON_FILE" >&2
  exit 1
fi

# Create milestones
jq -r '.[].milestone | select(.!=null)' "$JSON_FILE" | sort -u | while read -r M; do
  [[ -z "$M" ]] && continue
  if ! gh milestone list --repo "$REPO" --state open | grep -Fq "$M"; then
    gh milestone create "$M" --repo "$REPO" >/dev/null
  fi
done

# Create labels
jq -r '.[] | .labels[]? ' "$JSON_FILE" | sort -u | while read -r L; do
  [[ -z "$L" ]] && continue
  if ! gh label list --repo "$REPO" | awk '{print $1}' | grep -Fxq "$L"; then
    gh label create "$L" --repo "$REPO" --color FFFFFF >/dev/null
  fi
done

# Create issues
jq -c '.[]' "$JSON_FILE" | while read -r ITEM; do
  TITLE=$(echo "$ITEM" | jq -r '.title')
  BODY=$(echo "$ITEM" | jq -r '.body')
  MILE=$(echo "$ITEM" | jq -r '.milestone // empty')
  LABELS=$(echo "$ITEM" | jq -r '[.labels[]?] | join(",")')

  ARGS=(--repo "$REPO" --title "$TITLE" --body "$BODY")
  [[ -n "$MILE" ]] && ARGS+=(--milestone "$MILE")
  if [[ -n "$LABELS" ]]; then
    IFS=',' read -r -a LARR <<< "$LABELS"
    for lab in "${LARR[@]}"; do ARGS+=(--label "$lab"); done
  fi

  gh issue create "${ARGS[@]}"
done

echo "All issues created for $REPO from $JSON_FILE"


#!/usr/bin/env bash
set -euo pipefail
REPO=${1:-}
if [[ -z "$REPO" ]]; then echo "Usage: $0 <owner/repo>" >&2; exit 1; fi
if ! command -v gh >/dev/null; then echo "gh CLI required" >&2; exit 1; fi
labels=(bug feature frontend backend docs "help wanted" "good first issue" core qa automation config ai enhancement)
for l in "${labels[@]}"; do
  if ! gh label list --repo "$REPO" | awk '{print $1}' | grep -Fxq "$l"; then
    gh api repos/$REPO/labels -X POST -f name="$l" -f color=FFFFFF >/dev/null || true
    echo "created: $l"
  else
    echo "exists: $l"
  fi
done


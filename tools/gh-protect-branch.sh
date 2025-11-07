#!/usr/bin/env bash
set -euo pipefail
REPO=${1:-}
BRANCH=${2:-main}
if [[ -z "$REPO" ]]; then echo "Usage: $0 <owner/repo> [branch]" >&2; exit 1; fi
if ! command -v gh >/dev/null; then echo "gh CLI required" >&2; exit 1; fi
# Require PR reviews and status checks on the protected branch
gh api -X PUT repos/$REPO/branches/$BRANCH/protection \
  -f required_status_checks.strict=true \
  -f required_status_checks.strict=true \
  -f enforce_admins=true \
  -f restrictions=null \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=true \
  -f required_status_checks.contexts[]="Lint" \
  -f required_status_checks.contexts[]="Deemind Build Check" >/dev/null || true
echo "Branch protection attempted for $REPO:$BRANCH"


#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Create a backups-only restore-point tag and push it.
#
# Usage:
#   create-backup-tag.sh <tag-name> [source-ref]
#
# Builds a commit whose root tree contains only backups/ (from source-ref,
# default HEAD), tags it, and pushes via push-backup-tag.sh. Tenant branch
# commits are unchanged; the tag ref is a separate snapshot for restore/download.
#
# Environment:
#   SKIP_TAG_PUSH=1 — create/update local tag only (for tests)
# ---------------------------------------------------------------------------
set -euo pipefail

TAG_NAME="${1:?usage: create-backup-tag.sh <tag-name> [source-ref]}"
SOURCE_REF="${2:-HEAD}"

if ! BACKUPS_TREE=$(git rev-parse "${SOURCE_REF}:backups" 2>/dev/null); then
  echo "Error: ${SOURCE_REF} has no backups/ tree — cannot create restore-point tag" >&2
  exit 1
fi

TIMESTAMP="${TAG_NAME##*/}"
ROOT_TREE=$(printf '040000 tree %s\tbackups\n' "$BACKUPS_TREE" | git mktree)
TAG_COMMIT=$(
  git commit-tree "$ROOT_TREE" -m "backup: ${TIMESTAMP} snapshot (backups only)"
)
git tag -f "$TAG_NAME" "$TAG_COMMIT"

if [ "${SKIP_TAG_PUSH:-}" = "1" ]; then
  echo "Created tag ${TAG_NAME} at ${TAG_COMMIT} (push skipped)"
  exit 0
fi

bash "$(dirname "$0")/push-backup-tag.sh" "$TAG_NAME"

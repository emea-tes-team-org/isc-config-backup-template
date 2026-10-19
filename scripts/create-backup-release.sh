#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Publish a GitHub Release with a zip of flat backups/ on a backup tag.
#
# Usage:
#   create-backup-release.sh <tag-name> <tenant> [stats-json]
#
# Creates a release only when the tag's backups/ tree differs from the
# previous restore-point tag for the same tenant. The first tag for a tenant
# always publishes. Unchanged backup content skips release (exit 0, no gh call).
#
# Environment:
#   GH_TOKEN  — required for gh release create (set by Actions)
#   DRY_RUN=1 — build zip only; print zip path to stdout; skip gh release
# ---------------------------------------------------------------------------
set -uo pipefail

TAG_NAME="${1:?usage: create-backup-release.sh <tag-name> <tenant> [stats-json]}"
TENANT="${2:?usage: create-backup-release.sh <tag-name> <tenant> [stats-json]}"
STATS_JSON="${3:-}"

BACKUP_DIR="backups"
if [ ! -d "$BACKUP_DIR" ]; then
  echo "::warning::Backup directory ${BACKUP_DIR} not found — skipping release"
  exit 0
fi

# Previous restore-point tag: newest <tenant>/* tag by embedded timestamp, excluding current.
find_previous_tenant_tag() {
  local tenant="$1"
  local current="$2"
  git tag -l "${tenant}/*" \
    | { grep -Fxv "$current" || true; } \
    | sort -t/ -k2 -rn \
    | head -1
}

if NEW_TREE=$(git rev-parse "${TAG_NAME}:backups" 2>/dev/null); then
  PREV_TAG=$(find_previous_tenant_tag "$TENANT" "$TAG_NAME")
  if [ -n "$PREV_TAG" ]; then
    if PREV_TREE=$(git rev-parse "${PREV_TAG}:backups" 2>/dev/null); then
      if [ "$NEW_TREE" = "$PREV_TREE" ]; then
        echo "Backup content unchanged vs ${PREV_TAG} — skipping release"
        exit 0
      fi
    fi
  fi
fi

TIMESTAMP="${TAG_NAME##*/}"
ZIP_NAME="${TENANT}-${TIMESTAMP}.zip"
ZIP_DIR="${TMPDIR:-/tmp}/isc-backup-release-$$"
mkdir -p "$ZIP_DIR"
ZIP_PATH="${ZIP_DIR}/${ZIP_NAME}"

zip -r -q "$ZIP_PATH" "$BACKUP_DIR"

TITLE="ISC backup: ${TENANT} (${TIMESTAMP})"
NOTES="Backup restore point for tenant **${TENANT}** at \`${TIMESTAMP}\` UTC."

if [ -n "$STATS_JSON" ] && command -v jq >/dev/null 2>&1; then
  SIZE=$(echo "$STATS_JSON" | jq -r '.size // empty')
  FILES=$(echo "$STATS_JSON" | jq -r '.files // empty')
  ADDED=$(echo "$STATS_JSON" | jq -r '.added // empty')
  DELETED=$(echo "$STATS_JSON" | jq -r '.deleted // empty')
  MODIFIED=$(echo "$STATS_JSON" | jq -r '.modified // empty')
  if [ -n "$SIZE" ]; then
    NOTES="${NOTES}

### Backup statistics
- Size: ${SIZE} bytes
- Files: ${FILES}
- Added: ${ADDED}
- Deleted: ${DELETED}
- Modified: ${MODIFIED}"
  fi
fi

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "$ZIP_PATH"
  exit 0
fi

if gh release create "$TAG_NAME" --title "$TITLE" --notes "$NOTES" "$ZIP_PATH"; then
  echo "Created release ${TAG_NAME} with asset ${ZIP_NAME}"
  rm -rf "$ZIP_DIR"
  exit 0
fi

echo "::warning::Could not create release ${TAG_NAME}"
rm -rf "$ZIP_DIR"
exit 0

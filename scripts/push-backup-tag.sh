#!/usr/bin/env bash
# Push a backup restore-point tag with retries.
# Tag push failures are non-fatal: branch commits hold the backup data.
set -uo pipefail

TAG_NAME="${1:?usage: push-backup-tag.sh <tag-name>}"

if bash "$(dirname "$0")/push-with-retry.sh" origin "$TAG_NAME"; then
  echo "Pushed tag $TAG_NAME"
  exit 0
fi

echo "::warning::Could not push tag $TAG_NAME after retries (backup branch data may still be on origin)"
exit 0


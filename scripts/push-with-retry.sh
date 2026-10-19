#!/usr/bin/env bash
# Retry git push for transient GitHub 500 errors.
# Usage: push-with-retry.sh <git push args...>
# Example: push-with-retry.sh origin HEAD:tenant-branch
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: push-with-retry.sh <git push args...>" >&2
  exit 1
fi

MAX_ATTEMPTS="${PUSH_ATTEMPTS:-3}"
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if git push "$@"; then
    exit 0
  fi

  echo "Push attempt $attempt/$MAX_ATTEMPTS failed: git push $*"
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    sleep $((attempt * 15))
  fi
  attempt=$((attempt + 1))
done

exit 1

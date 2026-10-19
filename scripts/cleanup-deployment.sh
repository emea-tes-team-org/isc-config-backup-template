#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deactivate and delete GitHub Deployment records for a tenant environment.
#
# Backup jobs reference `environment:` for secret injection; GitHub creates a
# Deployment record per job. Run this in a follow-up job after the backup job
# completes so the platform has finished writing deployment status.
#
# Usage:
#   cleanup-deployment.sh <environment-name>
#
# Environment:
#   GH_TOKEN            — required (set by Actions)
#   GITHUB_REPOSITORY   — owner/repo (set by Actions)
#   DRY_RUN=1           — print what would be deleted; do not call delete APIs
#
# Failures are non-fatal: emits ::warning:: and exits 0.
# ---------------------------------------------------------------------------
set -uo pipefail

ENVIRONMENT="${1:?usage: cleanup-deployment.sh <environment-name>}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

encode_environment() {
  jq -rn --arg e "$1" '$e|@uri'
}

ENV_ENCODED=$(encode_environment "$ENVIRONMENT")
deleted=0
max_rounds=50
round=0

while [ "$round" -lt "$max_rounds" ]; do
  round=$((round + 1))
  DEPLOYMENT_IDS=""
  if ! DEPLOYMENT_IDS=$(gh api "repos/${REPO}/deployments?environment=${ENV_ENCODED}&per_page=100" --jq '.[].id' 2>/dev/null); then
    echo "::warning::Could not list deployments for environment ${ENVIRONMENT}"
    exit 0
  fi

  if [ -z "$DEPLOYMENT_IDS" ]; then
    break
  fi

  batch_deleted=0
  while IFS= read -r id; do
    [ -z "$id" ] && continue

    if [ "${DRY_RUN:-}" = "1" ]; then
      echo "Would delete deployment ${id} for environment ${ENVIRONMENT}"
      continue
    fi

    gh api -X POST "repos/${REPO}/deployments/${id}/statuses" -f state=inactive --silent 2>/dev/null || true
    if gh api -X DELETE "repos/${REPO}/deployments/${id}" --silent 2>/dev/null; then
      echo "Deleted deployment ${id} for environment ${ENVIRONMENT}"
      deleted=$((deleted + 1))
      batch_deleted=$((batch_deleted + 1))
    else
      echo "::warning::Could not delete deployment ${id} for environment ${ENVIRONMENT}"
    fi
  done <<< "$DEPLOYMENT_IDS"

  if [ "${DRY_RUN:-}" = "1" ]; then
    exit 0
  fi

  if [ "$batch_deleted" -eq 0 ]; then
    echo "::warning::Could not delete deployments for environment ${ENVIRONMENT}"
    exit 0
  fi
done

if [ "$round" -ge "$max_rounds" ]; then
  echo "::warning::Stopped deployment cleanup for ${ENVIRONMENT} after ${max_rounds} rounds"
fi

if [ "$deleted" -gt 0 ]; then
  exit 0
fi

echo "No deployment found for environment ${ENVIRONMENT} — nothing to clean up"
exit 0

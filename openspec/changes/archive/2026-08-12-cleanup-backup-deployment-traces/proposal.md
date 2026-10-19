# Proposal: Cleanup Ephemeral Backup Deployment Traces

## Why

Backup jobs use GitHub Environments solely to inject per-tenant ISC credentials. GitHub creates a Deployment record for every job that references `environment:`, and sets deployment status from the job outcome (`success` or `failure`). Operators see these as failed "deployments" on the Environments and Deployments pages even though no software is deployed — only configuration is exported to git.

With daily scheduled backups across many tenants, deployment history accumulates rapidly and suggests operational failures unrelated to the backup's actual purpose. Audit and restore points already live in git tags, tenant branch commits, Actions run history, and backup summary reports. Deployment records are an unintended side effect of secret scoping, not a first-class operator surface.

## What Changes

- **Cleanup helper** — new `scripts/cleanup-deployment.sh` deactivates and deletes the GitHub Deployment created for a tenant environment during the current backup job
- **Scheduled backup workflow** — `scheduled-backup.yml` matrix jobs invoke cleanup in a final `if: always()` step
- **Manual backup workflow** — `backup.yml` invokes the same cleanup step
- **Permissions** — backup workflows grant `deployments: write` for cleanup API calls
- **Tests** — unit tests for helper logic (mock `gh`); workflow reference test asserts cleanup step and permissions
- **Optional backlog sweep** — manual `cleanup-deployments.yml` workflow to delete historical deployment records (dry-run by default)
- **README** — clarify that Environments scope secrets; deployment history is not the backup audit trail

**Environment deployment history**
- From: every backup job leaves a Deployment record (success or failure) on the tenant Environment
- To: backup jobs delete their Deployment record before the job finishes; Environment and secrets unchanged
- Reason: Environments are for credential isolation, not deployment tracking
- Impact: non-breaking; backup artifacts and workflow behavior unchanged

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `platform-integration`: backup workflows SHALL remove ephemeral Deployment records after each tenant backup job; Environments and secrets are preserved
- `backup`: manual ISC Backup workflow SHALL run deployment cleanup after every job completion
- `scheduled-backup`: matrix backup jobs SHALL run deployment cleanup after every job completion
- `ubiquitous-language`: distinguish GitHub Environment (persistent, holds secrets) from ephemeral Deployment trace (created by Actions, deleted after backup)

## Impact

- **New files:** `scripts/cleanup-deployment.sh`, `scripts/test-cleanup-deployment.mjs`, optionally `.github/workflows/cleanup-deployments.yml`
- **Modified files:** `.github/workflows/scheduled-backup.yml`, `.github/workflows/backup.yml`, `scripts/test-workflow-references.mjs`, `README.md`
- **GitHub UI:** tenant Environment pages stop accumulating backup deployment history; Deployments tab stays clean after each run
- **Permissions:** `deployments: write` added to backup workflows (in addition to existing `contents: write`)
- **CLI:** no change — cleanup is workflow-only
- **Secrets / Environments:** no change — environments and `TENANT_URL` / `CLIENT_ID` / `CLIENT_SECRET` remain as today

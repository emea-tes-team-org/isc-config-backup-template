# Design: Cleanup Ephemeral Backup Deployment Traces

## Context

ISC Config Hub uses a branch-per-tenant model (ADR 0001, ADR 0002). Each tenant has a GitHub Environment named after the tenant (or an explicit `environment` override in `tenants.yaml`) holding `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET`. Backup workflows set `environment: ${{ matrix.environment }}` (scheduled) or `environment: ${{ inputs.tenant || github.ref_name }}` (manual) so Actions injects the correct credentials per matrix job.

GitHub Actions automatically creates a **Deployment** API object when a job references an environment. The deployment's final status mirrors the job conclusion. This is standard GitHub behavior — not configurable — and is unrelated to publishing application releases or the GitHub Releases created by manual backup.

Operators reported deployment records showing as **failures**. Investigation confirmed job failures (e.g. `Missing required environment variable: TENANT_URL` when environment secrets are absent) propagate to deployment status. Even successful backups leave deployment records that clutter the Environments UI.

Constraints: preserve Environment-based secret isolation; non-fatal auxiliary steps; GitHub UI first; match existing shell-helper patterns (`create-backup-release.sh`, `push-backup-tag.sh`).

## Goals / Non-Goals

**Goals:**
- After each backup job (scheduled or manual), delete the Deployment record GitHub created for that job's environment
- Run cleanup on both success and failure (`if: always()`)
- Preserve GitHub Environment objects and all environment-scoped secrets
- Non-fatal cleanup failures (warning only)
- Document that deployment history is not the backup audit trail

**Non-Goals:**
- Removing `environment:` from backup jobs (would break per-tenant secret injection)
- Deleting GitHub Environments or secrets
- Cleanup for restore, drift-detection, or tokenize workflows in v1
- Replacing Actions run history or backup summary reports as audit surfaces
- Fixing missing environment secrets (separate operational issue)

## Decisions

### D1: Post-job deletion via REST API

- **Choice:** Shell helper calls GitHub REST API: list latest deployment for environment → `POST .../statuses` with `state=inactive` → `DELETE .../deployments/{id}`
- **Reason:** GitHub provides no UI to bulk-delete deployments; API is the supported path
- **Considered alternatives:** Third-party Actions (e.g. `delete-deployment-environment`) — rejected to avoid external dependency and keep logic in-repo

### D2: Resolve deployment by environment + recency

- **Choice:** Helper accepts `<environment-name>`; queries `GET /repos/{owner}/{repo}/deployments?environment={name}&per_page=1` and deletes the newest match
- **Reason:** GitHub does not expose `deployment_id` reliably in all workflow contexts; matrix jobs use distinct environments so concurrent collision is unlikely
- **Considered alternatives:** Pass explicit deployment ID from workflow context — rejected due to inconsistent availability across runner versions

### D3: Cleanup always runs

- **Choice:** Final workflow step with `if: always()` after backup work completes
- **Reason:** Failed jobs currently leave red deployment entries; cleanup removes misleading failure history while job failure remains visible in Actions

### D4: Non-fatal cleanup

- **Choice:** Helper exits 0 with `::warning::` on API errors (404, permission denied, network)
- **Reason:** Consistent with release creation and tag push auxiliary steps; backup data on branch/tag is authoritative

### D5: `deployments: write` permission

- **Choice:** Add to `permissions` block in `backup.yml` and `scheduled-backup.yml`
- **Reason:** Required for deactivate + delete; `GITHUB_TOKEN` suffices for same-repo deployments

### D6: Optional historical sweep workflow

- **Choice:** `cleanup-deployments.yml` with `workflow_dispatch`, `dry_run` default `true`, optional `environment` filter
- **Reason:** One-time / periodic cleanup of deployment records created before this change
- **Considered alternatives:** Scheduled weekly sweep — deferred; operators can run manually when needed

### D7: Restore scripts from main on tenant branch jobs

- **Choice:** Cleanup step loads `scripts/cleanup-deployment.sh` from `main` via `git show main:scripts/...` (same pattern as tag and release helpers)
- **Reason:** Backup jobs checkout tenant branch for commits; scripts live on `main`

## Risks / Trade-offs

- [Risk] Wrong deployment deleted if two jobs share an environment concurrently → **Mitigation:** one environment per tenant in matrix; document constraint
- [Risk] Cleanup API rate limits on large fleets → **Mitigation:** one DELETE per job; N tenants = N calls per run (acceptable)
- [Trade-off] No deployment history on Environments page → **Accept:** git tags and Actions runs are the audit trail
- [Trade-off] Failed backups still fail the job; only the deployment *record* is removed → **Accept:** Actions UI shows failure; Environments page no longer shows stale red entries

## Migration Plan

1. Merge cleanup helper + tests
2. Update `scheduled-backup.yml` and `backup.yml` with cleanup step and permissions
3. Optionally add `cleanup-deployments.yml` for historical backlog
4. Document in README under Environments / Scheduled Backups
5. **Rollback:** Remove cleanup step; new deployments accumulate again (no data loss)

No downtime. Next backup run per tenant deletes its deployment trace.

## Open Questions

_(none — scope validated in brainstorm)_

# Brainstorm: Cleanup Backup Deployment Traces

## Problem

Backup workflows set `environment: <tenant>` on each job so GitHub injects tenant-scoped secrets (`TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET`). GitHub automatically creates a **Deployment** record for every such job. Operators see these on **Settings → Environments → [tenant] → Deployment history** and on the repository **Deployments** tab.

Observed issues:

1. **Misleading failure status** — GitHub maps job outcome to deployment status. When a backup job fails (e.g. missing secrets, ISC export error), the deployment shows as `failure` even though no application was deployed.
2. **Accumulating noise** — Daily scheduled backups for N tenants create N deployment records per run. Environments pages fill with backup audit clutter unrelated to real deployments.
3. **Wrong mental model** — Operators interpret red deployment history as infrastructure problems; backup audit belongs in git tags, branch commits, and `reports/backup-summary-*.md`.

## Clarifications

### Q1: Why not stop using GitHub Environments?

**Decision:** Keep Environments for secret isolation. GitHub Actions cannot dynamically resolve per-tenant secret names in a matrix without `environment:` (or equivalent). Repository-level secrets do not scale per tenant.

### Q2: Delete deployment records or just mark inactive?

**Decision:** **Delete** after each backup job. Inactive records still appear in history. Deletion requires `POST .../statuses` with `state=inactive` first, then `DELETE .../deployments/{id}`.

### Q3: Delete the GitHub Environment too?

**Decision:** **No.** Environments hold secrets. Only the ephemeral Deployment object created by the job is removed.

### Q4: Which workflows?

**Decision:** **Scheduled matrix backup** (`scheduled-backup.yml`) and **manual ISC Backup** (`backup.yml`). Restore and drift-detection also use `environment:` but are operator-initiated and lower volume — defer unless requested.

### Q5: Cleanup on failure?

**Decision:** **Yes, always** (`if: always()`). Failed backups should not leave permanent red deployment entries. Job failure is already visible in Actions run history and backup reports.

### Q6: Cleanup failure behavior?

**Decision:** **Non-fatal** — emit `::warning::`, exit 0. Mirrors release creation and tag push auxiliary steps. Backup outcome must not flip because cleanup failed.

### Q7: Historical backlog?

**Decision:** Optional manual **`cleanup-deployments.yml`** workflow (workflow_dispatch, dry-run default) to sweep pre-change deployment clutter. Not required for v1 but documented in design.

### Q8: Permissions?

**Decision:** Add `deployments: write` to backup workflows. `GITHUB_TOKEN` is sufficient for deactivate + delete deployments in the same repository; `ADMIN_TOKEN` not required.

## Risks accepted

| Risk | Mitigation |
|------|------------|
| Race if two jobs target same environment concurrently | Matrix uses one environment per tenant; unlikely collision |
| Wrong deployment deleted (latest for env) | Match by environment name + created during current run window; optional run_id correlation in helper |
| Operators lose deployment audit trail | Git tags, branch history, Actions logs, and backup reports remain authoritative |

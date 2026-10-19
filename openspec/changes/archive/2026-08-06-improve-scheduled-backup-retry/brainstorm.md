# Brainstorm: Improve Scheduled Backup Retry Recovery

Raw capture from design exploration (2026-08-06).

## Background

The scheduled backup matrix runs at midnight UTC with retry crons through 01:45. Investigation of run `31062414704` (2026-08-06):

1. Primary run at 01:19 failed on tag step for 7/8 tenants; `axa` failed on export poll (~10 min).
2. Run lasted until 01:30, overlapping retry cron slots.
3. `concurrency: cancel-in-progress: true` can cancel or block overlapping scheduled runs.
4. Later runs at 03:31/04:10 reported "No pending backups" — outside the 105-minute schedule window (`--check-schedule`), so retries correctly skipped tenants even though tags were missing.

Pending detection uses **latest backup tag timestamp only** (`parse-tenants.mjs` / `backup-pending-check` spec). When branch commit succeeds but tag fails, tenants remain pending (good) — but concurrency and long-running jobs prevent retry crons from picking them up within the window.

## Decision Chain

### Q1: Concurrency policy?

**Decision:** Set `cancel-in-progress: false` for `scheduled-backup-${{ github.ref }}`. Allow overlapping prepare-matrix runs; matrix jobs are idempotent for unchanged backups and guarded by pending check.

**Rejected:** Per-tenant concurrency groups — more complex; doesn't fix prepare-matrix overlap.

### Q2: Pending when commit exists but tag missing?

**Decision:** Extend pending logic: if tenant branch has a backup commit message matching today's window (`backup: YYYY-MM-DD`) with timestamp ≥ scheduled time, but no tag ≥ scheduled time, treat as **tag-pending** and include in matrix with a flag or detect in workflow.

**Simpler MVP:** Include tenant in matrix when tag is missing/stale even if commit exists; backup step detects unchanged data and only runs tag step (existing unchanged path).

**Reason:** Avoids full re-export when only tag push failed.

### Q3: Tag-only retry job?

**Decision:** **Defer.** First iteration: fix concurrency + ensure tag step works (depends on fix-backup-tag-script-path). Re-evaluate tag-only fast path if tag failures persist.

### Q4: Extend schedule window?

**Decision:** Keep 105-minute window aligned with cron entries. Fix concurrency first — delayed GitHub cron already causes runs outside window; widening window increases duplicate backup risk.

## Validated Scope

**In scope:** `cancel-in-progress: false`; pending check considers branch backup commit timestamp as secondary signal; tests for new pending scenarios; update scheduled-backup and backup-pending-check specs.

**Out of scope:** Tag script path fix (separate change); axa export timeout; changing cron schedule.

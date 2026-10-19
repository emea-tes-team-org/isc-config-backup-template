## Context

Scheduled backup uses explicit crons (midnight + retry band through 01:45 UTC) and `--check-schedule --check-pending` to build the matrix. Run `31062414704` demonstrated: long export polls + tag failures + `cancel-in-progress` prevented effective retries within the window.

Pending logic lives in `scripts/parse-tenants.mjs` with spec in `backup-pending-check`. Latest backup time comes from tag name timestamps only.

## Goals / Non-Goals

**Goals:**
- Retry crons can complete in-progress runs without cancellation
- Tenants missing tags after a successful branch commit re-enter the matrix within the schedule window
- Pending tests cover tag-missing / commit-present case

**Non-Goals:**
- Tag script path fix (prerequisite change: `fix-backup-tag-script-path`)
- Widening schedule window beyond existing cron union
- Tag-only matrix job type (defer unless needed after tag fix)

## Decisions

### D1: Concurrency policy
- **Choice:** `cancel-in-progress: false` on `scheduled-backup-${{ github.ref }}`
- **Reason:** Retry crons must not abort runs still tagging or exporting
- **Considered alternatives:** Separate concurrency group per cron slot (complex); per-tenant groups (doesn't help prepare-matrix)

### D2: Branch commit fallback for pending
- **Choice:** `getLatestBackupTime()` returns `max(tagTimestamp, branchCommitTimestamp)` where branch commit matches `backup: YYYY-MM-DD` on tenant branch and commit date ≥ scheduled window start
- **Reason:** Successful commit without tag should not block retry; unchanged backup path re-tags without re-export
- **Considered alternatives:** Separate `tag-pending` flag in matrix (more workflow branching); workflow_dispatch-only recovery (operator burden)

### D3: Branch commit detection
- **Choice:** `git log origin/<tenant> -1 --format=%cI --grep='^backup: '` with date filter for current UTC day
- **Reason:** Uses existing commit message convention; no new metadata files

### D4: Duplicate backup prevention
- **Choice:** When tag timestamp ≥ scheduled time, tenant not pending even if branch commit is newer
- **Reason:** Tag is authoritative restore point once present

## Risks / Trade-offs

- [Risk] Overlapping runs both backup same tenant → Mitigation: pending check + unchanged detection; idempotent commits
- [Risk] Extra git fetch per tenant in parse step → Mitigation: batch fetch in prepare-matrix or reuse existing fetch-depth
- [Trade-off] More workflow runs overlap briefly → Acceptable vs failed recovery

## Migration Plan

1. Deploy after `fix-backup-tag-script-path`
2. Change concurrency in `scheduled-backup.yml`
3. Extend `parse-tenants.mjs` and tests
4. Monitor next midnight window for retry success

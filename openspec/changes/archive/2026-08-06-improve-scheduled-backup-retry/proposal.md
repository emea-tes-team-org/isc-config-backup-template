## Why

When the midnight scheduled backup run fails partway through (tag errors, long-running export polls), retry crons within the 01:45 UTC window often do not recover. `cancel-in-progress: true` cancels or blocks overlapping runs while a long job (e.g. `axa` at ~10 minutes) is still active. Tenants with successful branch commits but missing tags remain untagged until manual intervention. Operators expect the hourly retry band to self-heal within the schedule window.

## What Changes

**Workflow concurrency**
- From: `cancel-in-progress: true` cancels in-progress scheduled backup when a new cron fires
- To: `cancel-in-progress: false` — overlapping runs complete; pending check prevents duplicate work
- Reason: retry crons must not abort a run that is still committing or tagging
- Impact: non-breaking; may run two prepare-matrix jobs briefly; matrix dedupes via pending

**Pending detection with branch commit fallback**
- From: pending determined solely by latest backup tag timestamp
- To: tenant is pending when tag is before scheduled window OR branch has no backup commit for window OR branch commit exists but tag is missing/stale for that window
- Reason: tag-only failures should re-enter matrix without requiring full re-export when data unchanged
- Impact: non-breaking; may include tenants for tag retry; unchanged path skips re-export

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `scheduled-backup`: concurrency policy and pending-driven retry behavior
- `backup-pending-check`: branch commit timestamp as secondary signal when tag absent or stale

## Impact

- **Modified files:** `.github/workflows/scheduled-backup.yml`, `scripts/parse-tenants.mjs`, `scripts/test-prune-tags.mjs` or new pending tests, `tenants.yaml` schema docs if needed
- **GitHub Actions:** failed midnight runs recover within retry window without manual dispatch
- **Fleet:** slightly more concurrent workflow minutes during overlap (bounded by cron count)

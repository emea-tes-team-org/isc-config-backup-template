## Why

Scheduled backups currently trigger every 15 minutes (96 runs/day). A tag-detection bug marks healthy tenants as perpetually pending, the workflow omits the `--check-schedule` filter on cron events, and failed tenants retry off-window for ~10 minutes per attempt. Together this drives **30,000+ GitHub Actions minutes/month** — far above typical quotas — while delivering no additional backup value outside schedule windows.

## What Changes

**Backup pending detection**
- From: Latest backup determined by git tag `--sort=-creatordate`
- To: Latest backup determined by max timestamp embedded in tag name (`<tenant>/YYYY-MM-DD_HH-MM-SS`)
- Reason: Squashed/recreated tags share creatordate; false pending causes redundant jobs
- Impact: Non-breaking; correct behavior per existing tag format

**Scheduled backup matrix filtering**
- From: Cron events use `--check-pending` only
- To: Cron events use `--check-schedule --check-pending`; manual dispatch without tenant uses `--check-pending` only
- Reason: Spec regression; failed tenants retry all day instead of in-window
- Impact: Non-breaking for operators; manual catch-up still available

**Cron polling frequency**
- From: `*/15 * * * *` (96 triggers/day)
- To: Explicit cron entries covering tenant schedule windows + 1-hour retry band (8/day for current all-midnight fleet)
- Reason: Eliminate idle orchestration runs
- Impact: Non-breaking; retries limited to retry band unless manual dispatch

**Idle job elimination**
- From: Summary always runs; dashboard triggers via `workflow_run` on every completion
- To: Skip summary when matrix count=0; generate dashboard inside summary; remove auto dashboard trigger
- Reason: Save runner minutes on no-op runs
- Impact: Non-breaking; dashboard artifact + manual dispatch preserved

**Backup job efficiency**
- From: Fresh `npm ci` every job; no timeout
- To: npm cache via setup-node; 15-minute job timeout
- Reason: Reduce per-job overhead; fail fast on hung API calls
- Impact: Non-breaking

## Capabilities

### New Capabilities

_(none — all changes extend existing capabilities)_

### Modified Capabilities

- `backup-pending-check`: Latest-tag selection MUST use embedded tag-name timestamp, not git creatordate
- `schedule-aware-parser`: Tag map for pending detection MUST compare parsed name timestamps
- `per-tenant-schedule`: Scheduled workflow MUST apply `--check-schedule` on cron-triggered runs
- `scheduled-backup`: Cron entries, idle skip, concurrency, npm cache, backup timeout
- `dashboard-generation`: Dashboard generated from summary job; auto `workflow_run` trigger removed

## Impact

- **Scripts:** `scripts/parse-tenants.mjs`, `scripts/test-parse-tenants.mjs`
- **Workflows:** `scheduled-backup.yml`, `dashboard.yml`, `backup.yml`, `drift-detection.yml`
- **Docs:** `README.md` (schedule/cron/retry behavior)
- **GitHub UI:** Scheduled ISC Backup Matrix runs less frequently; dashboard no longer appears as separate auto-run after each schedule tick; manual triggers unchanged
- **Dependencies:** Requires `package-lock.json` for npm cache (already present)

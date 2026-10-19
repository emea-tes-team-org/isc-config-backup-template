## Why

When a scheduled backup fails but an older restore-point tag still exists, the operations dashboard shows **✅ Healthy** because health is derived only from git metadata (tag date and object count). Operators saw this on ksb after the Aug 14 run failed with `FAILED_EXTERNAL_COMMUNICATION`: **Last** stayed on 2026-08-13 while **State** still read Healthy. The fleet already records per-tenant attempt outcomes (`failed`, `backed-up`, `unchanged`) in matrix JSON and daily summary reports, but that signal is not wired into dashboard generation. Misleading health status hides actionable backup failures.

## What Changes

**Dashboard State derivation**
- From: `✅ Healthy` when the tenant is active, has a last backup date, and object count > 0 — regardless of latest attempt outcome
- To: `⚠️ Backup failed` when the latest backup attempt status for the tenant is `failed`; `✅ Healthy` when status is `backed-up` or `unchanged` (or no failure recorded for the current report context)
- Reason: State must reflect whether the most recent backup attempt succeeded, not merely whether historical backup data exists
- Impact: non-breaking for restore/tags; README State column becomes trustworthy after failed runs

**Dashboard input plumbing**
- From: `generate-readme.mjs` / `generateDashboard()` use git lookups only
- To: Accept optional matrix backup results (CI) and fall back to parsing the latest `reports/backup-summary-*.md` for manual/local regeneration
- Reason: Reuse existing observability data without new storage
- Impact: `scheduled-backup.yml` summary step passes results into README generation

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `dashboard-generation`: Tenant Overview **State** column SHALL reflect latest backup attempt failure, not git metadata alone
- `reporting-observability`: Operator dashboard generation SHALL incorporate per-tenant attempt status from backup summary data

## Impact

- **Modified files:** `scripts/generate-dashboard.mjs`, `scripts/generate-readme.mjs`, `scripts/test-generate-dashboard.mjs`, `scripts/test-generate-readme.mjs`; possibly `scripts/generate-report.mjs` for shared status loading/parsing
- **Workflows:** `scheduled-backup.yml` summary job — pass backup results into README generation step
- **GitHub UI:** Generated `README.md` State column shows `⚠️ Backup failed` for tenants whose latest matrix attempt failed; Healthy after successful retry
- **CLI:** Local `node scripts/generate-readme.mjs` picks up failure status from latest committed report when present
- **Specs/tests:** Update `openspec/specs/dashboard-generation/spec.md` via delta; add automated scenarios in dashboard/readme tests

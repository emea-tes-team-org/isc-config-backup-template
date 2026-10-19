# Tasks: Dashboard Unhealthy on Backup Failure

## 1. Status loading helpers

- [x] 1.1 Add `loadAttemptStatusesFromResults(resultsJson)` in `scripts/generate-report.mjs` — returns `Map<tenant, status>` from normalized matrix JSON
- [x] 1.2 Add `parseAttemptStatusesFromReport(markdown)` in `scripts/generate-report.mjs` — parse Status column from backup summary table rows
- [x] 1.3 Export helpers for use by `generate-readme.mjs`
- [x] 1.4 Add unit tests in `scripts/test-generate-report.mjs` for JSON and markdown parsing (failed / backed-up / unchanged rows)

## 2. Dashboard state derivation

- [x] 2.1 Extend `formatTenantState(tenant, lastBackup, objectCount, attemptStatus)` in `scripts/generate-dashboard.mjs` — return `⚠️ Backup failed` when `attemptStatus === "failed"`
- [x] 2.2 Thread optional `attemptStatuses` through `generateDashboard()` → `renderTenantRow()`
- [x] 2.3 Export updated function signatures for test stubs
- [x] 2.4 Add tests in `scripts/test-generate-dashboard.mjs`:
  - failed attempt + existing backups → `⚠️ Backup failed`
  - unchanged attempt → `Healthy`
  - no attempt status → existing Healthy fallback
  - inactive tenant unchanged

## 3. README generation plumbing

- [x] 3.1 Extend `generate-readme.mjs` to resolve attempt statuses: env `BACKUP_RESULTS` or CLI `--results` first, else parse latest report via `findLatestReport()`
- [x] 3.2 Pass resolved map into `generateDashboard()`
- [x] 3.3 Add tests in `scripts/test-generate-readme.mjs` for results env and report fallback paths

## 4. Scheduled backup workflow

- [x] 4.1 Update `scheduled-backup.yml` summary step: set `BACKUP_RESULTS` from merged `backup-results/*.json` before `node scripts/generate-readme.mjs`
- [x] 4.2 Run `node scripts/test-workflow-references.mjs` if workflow structure assertions exist for summary job

## 5. Documentation and changelog

- [x] 5.1 Update CHANGELOG Unreleased: dashboard State reflects failed backup attempts
- [x] 5.2 N/A — operator-facing README is generated; no static docs edit required beyond changelog

## 6. Verification

- [x] 6.1 Run `node scripts/test-generate-dashboard.mjs`
- [x] 6.2 Run `node scripts/test-generate-readme.mjs`
- [x] 6.3 Run `node scripts/test-generate-report.mjs`
- [x] 6.4 Manual smoke: generate README with mocked failed ksb status and confirm State column

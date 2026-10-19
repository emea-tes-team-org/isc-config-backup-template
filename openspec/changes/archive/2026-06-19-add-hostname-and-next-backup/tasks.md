## 1. Extract cron utilities into shared module

- [x] 1.1 Create `scripts/cron-utils.mjs` exporting `matchesCron`, `nextCronTime`, `previousCronTime` (move from `parse-tenants.mjs` lines 24-96).
- [x] 1.2 Update `scripts/parse-tenants.mjs` to import from `./cron-utils.mjs` and remove the duplicated function bodies.
- [x] 1.3 Add `scripts/test-cron-utils.mjs` covering: exact match, minute mismatch, malformed expression, nextCronTime across days/months, nextCronTime exhaustion, previousCronTime.
- [x] 1.4 Verify `node scripts/test-cron-utils.mjs` and `node scripts/test-parse-tenants.mjs` both pass.

## 2. Add hostname to tenants.yaml and registry output

- [x] 2.1 Edit `tenants.yaml` to add `hostname:` and `description:` to each of the four tenants (`company12926-poc`, `company21280-poc`, `axa`, `andre`).
- [x] 2.2 Update `scripts/parse-tenants.mjs` matrix mapping (line 207-212) to include `hostname` from the registry on every entry.
- [x] 2.3 Update `scripts/test-parse-tenants.mjs` to expect `hostname` in the matrix output and to set `hostname` in the synthetic YAML.

## 3. Add Hostname and Next Backup columns to dashboard

- [x] 3.1 In `scripts/generate-dashboard.mjs`, import `nextCronTime` from `./cron-utils.mjs`.
- [x] 3.2 Update the table header (line 141) to include `Hostname` and `Next Backup` columns.
- [x] 3.3 Update `renderTenantRow` (lines 104-121) to emit hostname (or `—` if missing) and next backup (or `daily` if no schedule, otherwise formatted next cron match).
- [x] 3.4 Update existing assertions in `scripts/test-generate-dashboard.mjs` to include the new columns.
- [x] 3.5 Add new test cases for: tenant with hostname, tenant without hostname (`—`), scheduled tenant next-backup formatting, daily-default (`daily`).
- [x] 3.6 Verify `node scripts/test-generate-dashboard.mjs` passes.

## 4. Create generate-report.mjs and refactor scheduled-backup.yml

- [x] 4.1 Create `scripts/generate-report.mjs` exporting `generateReport(resultsJson, registry, now)` that mirrors the existing report format with the new columns.
- [x] 4.2 Replicate the three section logic from `scheduled-backup.yml` lines 220-245 (result rows, up-to-date rows, skipped rows) in the new script.
- [x] 4.3 Add Hostname and Next Backup columns to the new report table (parity with dashboard).
- [x] 4.4 Add `scripts/test-generate-report.mjs` covering: all-backed-up, mixed-status (unchanged + failed), skipped, up-to-date, missing hostname (`—`), scheduled vs daily next-backup.
- [x] 4.5 Replace the inline bash in `.github/workflows/scheduled-backup.yml` (lines 199-252) with a call to `node scripts/generate-report.mjs` accepting the results JSON and registry path as arguments.
- [x] 4.6 Verify `node scripts/test-generate-report.mjs` passes.

## 5. Validate and finalize

- [x] 5.1 Run `openspec validate add-hostname-and-next-backup --type change --strict` and resolve any errors.
- [x] 5.2 Run all four test scripts (`test-cron-utils`, `test-parse-tenants`, `test-generate-dashboard`, `test-generate-report`) and confirm they all pass.
- [x] 5.3 Manually diff a freshly generated `reports/backup-summary-*.md` against the existing fixture in `reports/backup-summary-2026-06-19.md` to confirm column set, ordering, and totals are preserved.

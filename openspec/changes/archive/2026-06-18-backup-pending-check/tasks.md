## 1. Implement pending backup check

- [x] 1.1 Add a script or workflow step to fetch the latest backup tag for each tenant
- [x] 1.2 Compute the tenant's scheduled time for the current UTC day from its cron expression
- [x] 1.3 Compare latest backup timestamp with scheduled time and mark tenant as pending or up-to-date
- [x] 1.4 Expose pending status and skip reason in the matrix output

## 2. Update workflow filtering

- [x] 2.1 Remove manual-dispatch schedule bypass; apply pending check to both schedule and workflow_dispatch triggers
- [x] 2.2 Filter out tenants whose backup is already up to date in the prepare-matrix job
- [x] 2.3 Pass skip reason (schedule-mismatch vs up-to-date) to the summary job

## 3. Update backup summary reporting

- [x] 3.1 Add `up-to-date` status to Backup Summary table
- [x] 3.2 Distinguish `skipped` (schedule mismatch) from `up-to-date` (already backed up) in reports
- [x] 3.3 Persist updated summary format to `reports/backup-summary-*.md`

## 4. Validate and archive

- [x] 4.1 Run `openspec validate backup-pending-check --type change --strict`
- [x] 4.2 Fix any validation errors in delta specs
- [x] 4.3 Archive change with `openspec archive backup-pending-check --yes`

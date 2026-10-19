## Why

The current centralized scheduler (`scheduled-backup.yml`) runs all active tenant backups simultaneously at 06:00 UTC. As the tenant count grows, this creates massive concurrency: API rate-limiting risk, noisy neighbor problems, and confusing reporting when many matrix jobs fail or succeed together. We need a simple mechanism to stagger tenant backups over time while preserving the benefits of centralized scheduling.

## What Changes

- Add optional `schedule` field to `tenants.yaml` entries (cron expression per tenant)
- Modify `scripts/parse-tenants.mjs` to accept a `--check-schedule` flag that filters tenants whose cron expression matches the current UTC time
- Update `scheduled-backup.yml` cron trigger to run every 15 minutes instead of once daily
- Add schedule display to backup summary reports so the team can see each tenant's configured window
- Allow manual `workflow_dispatch` runs to bypass schedule filtering (run any tenant at any time)

## Capabilities

### New Capabilities
- `per-tenant-schedule`: Define and enforce individual backup windows per tenant via `tenants.yaml`
- `schedule-aware-parser`: Filter active tenants by cron match at workflow runtime
- `tenant-schedule-reporting`: Display each tenant's schedule in backup summary reports

### Modified Capabilities
- `backup-summary-report`: Include each tenant's schedule window in reports for visibility
- `tenant-registry`: Extend `tenants.yaml` format to support optional `schedule:` field per tenant

## Impact

- `tenants.yaml`: New optional `schedule:` field (defaults to daily if omitted for backward compatibility)
- `scripts/parse-tenants.mjs`: New `--check-schedule` CLI flag and cron matching logic
- `.github/workflows/scheduled-backup.yml`: More frequent cron trigger (every 15 min) + conditional filtering logic
- `reports/backup-summary-*.md`: Additional schedule column
- No changes to backup script logic, secrets, or branch structure

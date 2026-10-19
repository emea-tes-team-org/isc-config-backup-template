## Why

The scheduled backup workflow currently runs every tenant backup on every trigger, whether scheduled or manual. This means a tenant scheduled for 06:00 UTC can be backed up multiple times if the workflow is triggered repeatedly after that time. We need to ensure each tenant is backed up at most once per scheduled window, so runs are skipped when the backup is already up to date.

## What Changes

- Add a pending-backup check that compares the tenant's last successful backup timestamp with its scheduled time for the current day
- Skip tenants whose latest backup tag is dated at or after today's scheduled run time
- Apply the pending check to both `schedule` and `workflow_dispatch` triggers (manual runs still respect the daily window)
- Keep the existing cron schedule matching logic; the pending check runs after schedule matching
- Report skipped-due-to-up-to-date tenants in the backup summary

## Capabilities

### New Capabilities
- `backup-pending-check`: Determine whether a tenant's scheduled backup is still pending by inspecting existing backup tags

### Modified Capabilities
- `per-tenant-schedule`: Extend behaviour so a schedule match only results in a backup when one has not already run for that window
- `backup-summary-report`: Add reporting for tenants skipped because their backup is already up to date

## Impact

- `scripts/parse-tenants.mjs` and/or the workflow will query git tags to find the latest backup timestamp per tenant
- `.github/workflows/scheduled-backup.yml` will run the pending check before starting backup jobs
- Backup summary reports gain visibility into "up-to-date" skips
- No changes to backup script logic, secrets, or branch structure

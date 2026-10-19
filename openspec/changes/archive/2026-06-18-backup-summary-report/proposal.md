## Why

The scheduled backup workflow currently generates a "Backup Summary" job that creates an empty markdown table and only prints the total number of tenants. Operators cannot see which tenants succeeded, failed, or had no changes without opening each matrix job log. Additionally, the summary is written only to `$GITHUB_STEP_SUMMARY`, so it disappears once the workflow run is cleaned up and cannot be referenced later. This change makes the backup report actionable and durable.

## What Changes

- Update the `summary` job in `.github/workflows/scheduled-backup.yml` to collect per-tenant results from the matrix `backup` job and render a complete status table (tenant, status, tag if backed up).
- Extend each matrix `backup` job to emit a structured output (`status`, `tag`, `message`) that the `summary` job can consume.
- Add a step in the `summary` job that writes the same report to a persistent markdown file under `reports/backup-summary-<date>.md` and commits it to the tenant branch (or a dedicated reports branch) so it survives workflow run retention.
- Keep the existing `$GITHUB_STEP_SUMMARY` output for immediate visibility in the Actions UI.

## Capabilities

### New Capabilities

- `backup-summary-report`: Generate and persist a detailed backup summary report that includes per-tenant status, timestamp, and tag information.

### Modified Capabilities

- None.

## Impact

- `.github/workflows/scheduled-backup.yml`: the `backup` and `summary` jobs.
- New `reports/` directory on tenant branches (created on first run).
- No impact on the actual backup data in `backups/` or on existing tags.

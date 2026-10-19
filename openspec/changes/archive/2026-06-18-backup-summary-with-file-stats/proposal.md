## Why

Operators currently have to inspect raw git diffs or open individual backup job logs to understand what changed during a backup run. A concise summary of file-level statistics — total size, file count, added files, deleted files, and modified files — would make both scheduled and manual backups immediately transparent and help detect unexpected configuration drift.

## What Changes

- Extend the backup step in both `.github/workflows/scheduled-backup.yml` and `.github/workflows/backup.yml` to compute file-level statistics before committing.
- Surface those statistics in the workflow log summary and, for `scheduled-backup.yml`, in the existing `Backup Summary` job output.
- Persist the statistics alongside the backup report in `reports/backup-summary-<date>.md` for scheduled runs.
- Add a lightweight shell helper (or inline script) to compute statistics from `git status --porcelain` and `du`/`wc` without changing the backup data format.

## Capabilities

### New Capabilities

- `backup-file-statistics`: Compute and display file-level statistics (size, total files, added, deleted, modified) for each backup run.
- `manual-backup-summary`: Produce a human-readable summary when `.github/workflows/backup.yml` runs manually.

### Modified Capabilities

- `backup-summary-report`: Extend the scheduled backup summary to include file statistics per tenant in addition to status and tag.

## Impact

- `.github/workflows/scheduled-backup.yml`: backup and summary jobs.
- `.github/workflows/backup.yml`: backup job output.
- Possible new helper script under `scripts/` or inline shell in the workflows.
- No changes to the structure or content of files under `backups/`.

## 1. Create backup statistics helper

- [x] 1.1 Add `scripts/backup-stats.sh` that computes total size, total file count, added, deleted, and modified counts from `backups/` and `git status --porcelain`.
- [x] 1.2 Make the script output a compact JSON payload that workflows format into markdown for logs and reports.

## 2. Update scheduled backup workflow

- [x] 2.1 Call `scripts/backup-stats.sh` in each matrix `backup` job before committing and capture its output.
- [x] 2.2 Add a single `result` job output containing tenant, status, tag, size, files, added, deleted, and modified.
- [x] 2.3 Update the `summary` job to parse the new outputs and add statistics columns to the markdown table.
- [x] 2.4 Include the statistics in the persisted `reports/backup-summary-<date>.md` file committed to `main`.

## 3. Update manual backup workflow

- [x] 3.1 Call `scripts/backup-stats.sh` in `backup.yml` after the backup script runs.
- [x] 3.2 Print a human-readable summary block to the workflow log that includes status, tag (if any), and file statistics.

## 4. Validate and verify

- [x] 4.1 Run `openspec validate backup-summary-with-file-stats --type change --strict` before archiving.
- [x] 4.2 Trigger `backup.yml` manually and verify the log summary shows file statistics.
- [x] 4.3 Trigger or wait for `scheduled-backup.yml` and verify the Backup Summary table includes file statistics.
- [x] 4.4 Confirm `reports/backup-summary-<date>.md` on the `main` branch includes the file statistics.

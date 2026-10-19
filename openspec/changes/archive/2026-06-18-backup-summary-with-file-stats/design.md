## Context

The repository has two backup workflows:
- `.github/workflows/scheduled-backup.yml`: runs daily for all active tenants and produces a `Backup Summary` job.
- `.github/workflows/backup.yml`: runs manually for a single tenant branch and has no summary output.

Neither workflow currently reports file-level statistics about what changed during the backup. Operators must inspect git diffs or individual job logs to understand the scope of changes.

## Goals / Non-Goals

**Goals:**
- Compute file statistics for every backup run: total size, total file count, added count, deleted count, modified count.
- Surface those statistics in the `Backup Summary` job for scheduled runs.
- Surface a concise summary in the manual `backup.yml` workflow log.
- Persist the enhanced scheduled report to `main` under `reports/`.

**Non-Goals:**
- Changing the backup data format or directory structure under `backups/`.
- Adding external storage or notification systems.
- Tracking per-file size changes in the summary.

## Decisions

1. **Compute statistics from the git index before committing.**
   - After `node scripts/backup.mjs` runs and before `git commit`, run `git status --porcelain` and parse the output to count added (`A`), deleted (`D`), and modified (`M`) entries.
   - Use `du -sb backups/` for total size and `find backups/ -type f | wc -l` for total file count.
   - *Alternative considered:* Computing stats after commit by comparing tags. Rejected because it requires fetching history and is more complex; pre-commit stats are deterministic and available immediately.

2. **Share a single helper script across both workflows.**
   - Add `scripts/backup-stats.sh` that outputs a compact JSON payload with the statistics.
   - Both `scheduled-backup.yml` and `backup.yml` call the same script and format the markdown themselves, ensuring consistent source data.
   - *Alternative considered:* Inline shell in each workflow. Rejected to avoid duplication and drift.

3. **Pass statistics via a single job output in scheduled-backup.yml.**
   - Each matrix `backup` job emits a single `result` output containing `tenant`, `status`, `tag`, `size`, `files`, `added`, `deleted`, and `modified` as compact JSON.
   - The `summary` job reads these outputs and adds columns to the report table.
   - *Alternative considered:* Computing stats again in the summary job. Rejected because the backup working tree is not available in the summary job.

4. **Keep backup.yml changes minimal.**
   - `backup.yml` simply prints the markdown snippet to the job log after committing.
   - No matrix outputs or persistent report are needed for the manual workflow.

## Risks / Trade-offs

- [Stats are computed against the working tree, not the committed tree] -> Mitigation: stats are captured immediately before commit, which matches the changes being pushed.
- [Added helper script must be available on tenant branches] -> Mitigation: both workflows check out `main` for scripts; the helper lives in `scripts/` on `main`.
- [Extra columns may make the summary table wide] -> Mitigation: use compact numeric columns and omit units where obvious.

## Migration Plan

1. Merge the new helper script and workflow changes.
2. Run `backup.yml` manually to verify the log summary appears.
3. Wait for or trigger the scheduled workflow to verify the enhanced `Backup Summary` table and persisted report.
4. Rollback: revert the workflow files and the helper script.

## Open Questions

- Should statistics be rounded (e.g., KB/MB) or kept in bytes for precision?
- Should the manual `backup.yml` also persist a report file?

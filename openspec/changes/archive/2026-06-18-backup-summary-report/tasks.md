## 1. Emit per-tenant backup results from matrix jobs

- [x] 1.1 Declare `outputs` on the `backup` job for `tenant`, `status`, and `tag`.
- [x] 1.2 Update the `Report status` step to write `tenant`, `status`, and `tag` to `$GITHUB_OUTPUT` for each outcome (`backed-up`, `unchanged`, `failed`).

## 2. Render a complete per-tenant summary table

- [x] 2.1 Update the `summary` job to parse `needs.backup.outputs` as JSON and iterate over each matrix result.
- [x] 2.2 Generate markdown table rows with columns: Tenant, Status, Tag.
- [x] 2.3 Append the populated report to `$GITHUB_STEP_SUMMARY`.

## 3. Persist the report to the repository

- [x] 3.1 Add a step in the `summary` job to write the same markdown report to `reports/backup-summary-<YYYY-MM-DD>.md`.
- [x] 3.2 Check out the main branch, add the report file, and commit/push it without creating a tag.
- [x] 3.3 Handle the case where `reports/` does not yet exist on the branch.

## 4. Validate and verify

- [x] 4.1 Run `openspec validate backup-summary-report --type change --strict` before archiving.
- [x] 4.2 Trigger the workflow manually (or wait for the cron run) and verify the Backup Summary table shows per-tenant statuses.
- [x] 4.3 Confirm a `reports/backup-summary-<date>.md` file exists on the main branch after the run.

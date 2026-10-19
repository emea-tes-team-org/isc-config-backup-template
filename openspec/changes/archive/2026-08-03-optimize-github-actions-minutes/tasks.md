## 1. Fix backup tag timestamp detection

- [x] 1.1 Add `parseTagTimestamp(tagName)` helper in `scripts/parse-tenants.mjs` parsing `<tenant>/YYYY-MM-DD_HH-MM-SS`
- [x] 1.2 Rewrite `getLatestTagMap()` to select max name-embedded timestamp per tenant (remove `--sort=-creatordate`)
- [x] 1.3 Add regression tests in `scripts/test-parse-tenants.mjs` for creatordate vs name-timestamp conflict (covers scenario: Latest tag selected by name timestamp not creatordate)
- [x] 1.4 Verify `node scripts/parse-tenants.mjs --active-only --check-pending` excludes healthy tenants with today's tags

## 2. Re-enable schedule gate in workflow

- [x] 2.1 Update `prepare-matrix` in `scheduled-backup.yml`: cron path uses `--check-schedule --check-pending`
- [x] 2.2 Set `SCHEDULE_MATCH` output from `--check-schedule` result (not all active tenants)
- [x] 2.3 Keep `workflow_dispatch` without tenant on `--check-pending` only; tenant input bypass unchanged
- [x] 2.4 Run `node scripts/test-workflow-references.mjs` and `node scripts/test-generate-report.mjs`

## 3. Narrow cron to schedule windows

- [x] 3.1 Replace `*/15 * * * *` with explicit cron entries for midnight fleet + 1-hour retry band
- [x] 3.2 Add workflow comment documenting how to add cron lines for new tenant schedules
- [x] 3.3 Verify active tenant schedules are covered by cron union (script or manual checklist)

## 4. Skip idle jobs and merge dashboard

- [x] 4.1 Change summary job `if` to run only when `count != '0'`
- [x] 4.2 Add "No pending backups" log step in prepare-matrix when count=0
- [x] 4.3 Inline dashboard generation + artifact upload in summary job
- [x] 4.4 Remove `workflow_run` trigger from `dashboard.yml`; keep `workflow_dispatch`
- [x] 4.5 Add `concurrency: cancel-in-progress` to `scheduled-backup.yml`

## 5. Cache npm and fail fast on backup

- [x] 5.1 Add `cache: 'npm'` to setup-node in `scheduled-backup.yml`, `backup.yml`, `drift-detection.yml`
- [x] 5.2 Add `timeout-minutes: 15` to backup/drift jobs
- [x] 5.3 Confirm `package-lock.json` exists for cache key

## 6. Documentation

- [x] 6.1 Update README schedule/cron/retry-band description (remove "every 15 minutes" if present)
- [x] 6.2 Document dashboard artifact location after scheduled runs (was auto workflow_run)
- [x] 6.3 [x] Update CLI --help — N/A, no CLI surface changes in this change

## 7. Changelog

- [x] 7.1 Create or update changelog entry for GitHub Actions minutes optimization
- [x] 7.2 Confirm entry covers cron reduction, schedule gate fix, tag detection fix, and dashboard trigger change

# Tasks: Improve Scheduled Backup Retry

## 1. Concurrency

- [x] 1.1 Set `cancel-in-progress: false` in `.github/workflows/scheduled-backup.yml` concurrency block
- [x] 1.2 Update `scripts/test-workflow-references.mjs` assertion for concurrency policy

## 2. Pending detection

- [x] 2.1 Add `getLatestBranchBackupTime(tenant)` in `scripts/parse-tenants.mjs` using `git log origin/<tenant> --grep='^backup: '`
- [x] 2.2 Update `getLatestBackupTime` / `checkBackupPendingState` to use `max(tag, branchCommit)` when tag missing for window
- [x] 2.3 Export helpers for unit tests

## 3. Tests

- [x] 3.1 Add scenarios to pending test file: branch commit without tag → pending; tag present → not pending
- [x] 3.2 Run pending + workflow reference tests

## 4. Documentation

- [x] 4.1 Document retry behavior and branch-commit fallback in README scheduled backup section
- [x] 4.2 N/A — no API/connector docs affected

## 5. Changelog

- [x] 5.1 Add CHANGELOG entry for retry recovery improvements
- [x] 5.2 Confirm entry mentions concurrency and pending fallback

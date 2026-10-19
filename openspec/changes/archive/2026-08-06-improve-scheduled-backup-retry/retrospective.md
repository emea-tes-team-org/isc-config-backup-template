# Retrospective: improve-scheduled-backup-retry

> Written: 2026-08-06

---

## 0. Evidence

- **Tasks done**: 11/11
- **Tests**: parse-tenants +25 assertions, workflow refs updated

## 1. Wins

- Pending logic distinguishes `missing-tag` from generic `pending` for operator clarity
- Injectable `runGit` in `getLatestBranchBackupTime` keeps tests hermetic

## 2. Misses

- None blocking

## 3. Plan deviations

Renamed `getLatestBackupTime` → `getLatestTagBackupTime` for clarity (exported).

## 5. Surprises

- Branch commit after scheduled time is pending (not up-to-date) — intentional for tag-only retry path

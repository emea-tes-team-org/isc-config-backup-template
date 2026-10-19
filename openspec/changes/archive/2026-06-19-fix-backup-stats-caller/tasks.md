## 1. Fix scheduled-backup.yml caller

- [x] 1.1 Change line 111 from `bash scripts/backup-stats.sh` to `node scripts/generate-backup-stats.mjs`

## 2. Fix backup.yml caller

- [x] 2.1 Change line 60 from `bash scripts/backup-stats.sh` to `node scripts/generate-backup-stats.mjs`

## 3. Add regression guard

- [x] 3.1 Create `scripts/test-workflow-references.mjs` that asserts:
  - No workflow file contains `scripts/backup-stats.sh`
  - `backup.yml` and `scheduled-backup.yml` contain `generate-backup-stats.mjs`
- [x] 3.2 Verify `node scripts/test-workflow-references.mjs` passes

## 4. Verify

- [x] 4.1 Run all test scripts to confirm nothing regressed
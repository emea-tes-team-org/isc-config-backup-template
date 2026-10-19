# Tasks: Make Releases Only the Contents of ./backups

## 1. Shared backup tag helper

- [x] 1.1 Create `scripts/create-backup-tag.sh` accepting `<tag-name> [source-ref]` (default `HEAD`)
- [x] 1.2 Implement backups-only root tree via `git rev-parse`, `git mktree`, and `git commit-tree`
- [x] 1.3 Tag the new commit and delegate push to `scripts/push-backup-tag.sh`
- [x] 1.4 Fail fast with clear error when `source-ref:backups` is missing

## 2. Workflow integration

- [x] 2.1 Update `.github/workflows/backup.yml` to call `create-backup-tag.sh` instead of `git tag` on branch HEAD
- [x] 2.2 Update `.github/workflows/scheduled-backup.yml` for both commit and unchanged tag paths
- [x] 2.3 Extend `scripts/test-workflow-references.mjs` to assert both workflows invoke `create-backup-tag.sh`

## 3. Automated tests (spec scenario coverage)

- [x] 3.1 Create `scripts/test-create-backup-tag.sh` (or `.mjs`) with a temporary git repo fixture
- [x] 3.2 Test: tag tree contains `backups/<tenant>/` — maps to backup spec "Tag commit contains only backups tree"
- [x] 3.3 Test: tag tree excludes `.tenant.yaml` and `.gitignore` — maps to backup + scheduled-backup tag scenarios
- [x] 3.4 Test: tag commit SHA ≠ branch HEAD when branch has metadata — maps to backup spec "Tag commit differs from branch HEAD"
- [x] 3.5 Test: restore path `backups/<tenant>/...` readable at tag — maps to scheduled-backup "Restore from scheduled backup tag"
- [x] 3.6 Run `node scripts/test-workflow-references.mjs` and new tag helper tests

## 4. Documentation

- [x] 4.1 Update README: restore-point tags contain only `./backups`; branch commits unchanged
- [x] 4.2 Update inline script header comments in `create-backup-tag.sh` with usage and tree semantics
- [x] 4.3 N/A — no API/connector docs affected (mark complete with reason in commit if needed)

## 5. Changelog

- [x] 5.1 Add CHANGELOG entry under Unreleased for backups-only restore-point tags
- [x] 5.2 Confirm entry covers operator-visible tag download / restore-point behavior

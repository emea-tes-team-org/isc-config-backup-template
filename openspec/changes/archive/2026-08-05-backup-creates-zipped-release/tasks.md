# Tasks: Manual Backup Creates Zipped GitHub Release

## 1. Shared release helper

- [x] 1.1 Create `scripts/create-backup-release.sh` accepting `<tag-name> <tenant>` and optional stats JSON
- [x] 1.2 Zip `backups/<tenant>/` to `<tenant>-<timestamp>.zip` (timestamp from tag suffix)
- [x] 1.3 Publish GitHub Release via `gh release create` with title, notes, and zip asset
- [x] 1.4 Emit `::warning::` and exit 0 on release failure (non-fatal)

## 2. Manual backup workflow integration

- [x] 2.1 Add release step to `.github/workflows/backup.yml` after successful tag push (`STATUS=backed-up`)
- [x] 2.2 Pass `TAG`, `TARGET_TENANT`, and backup stats to the helper
- [x] 2.3 Extend `scripts/test-workflow-references.mjs` to assert `backup.yml` invokes `create-backup-release.sh`
- [x] 2.4 Assert `scheduled-backup.yml` does NOT invoke `create-backup-release.sh`

## 3. Tag retention release cleanup

- [x] 3.1 Extend `scripts/prune-tags.mjs` to delete GitHub Release for each pruned tag via `gh release delete`
- [x] 3.2 Ignore missing-release errors (404) when no release exists for a tag
- [x] 3.3 Update step summary to include deleted release count

## 4. Automated tests (spec scenario coverage)

- [x] 4.1 Create `scripts/test-create-backup-release.mjs` with temp fixture directory
- [x] 4.2 Test: zip contains `backups/<tenant>/` paths — maps to backup "Manual backup with changes creates release"
- [x] 4.3 Test: zip excludes `.tenant.yaml` and `.gitignore` — maps to backup zip content scenario
- [x] 4.4 Test: helper skips or no-ops when backup dir missing — maps to unchanged path guard
- [x] 4.5 Extend or add prune-tags test for release deletion logic — maps to "Pruned backup tag release is deleted"
- [x] 4.6 Run `node scripts/test-create-backup-release.mjs` and `node scripts/test-workflow-references.mjs`

## 5. Documentation

- [x] 5.1 Update README: manual ISC Backup publishes a GitHub Release with downloadable zip
- [x] 5.2 Update inline script header comments in `create-backup-release.sh` with usage
- [x] 5.3 N/A — no API/connector docs affected (mark complete with reason if needed)

## 6. Changelog

- [x] 6.1 Add CHANGELOG entry under Unreleased for manual backup GitHub Releases
- [x] 6.2 Confirm entry covers Releases-page zip download behavior

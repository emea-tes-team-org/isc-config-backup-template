# Proposal: Manual Backup Creates Zipped GitHub Release

## Why

Manual ISC Backup runs create git tags operators use as restore points, but there is no GitHub Release and no dedicated zip download on the Releases page. Operators who want a portable configuration bundle must clone the repo or download a tag archive that may include branch metadata (`.tenant.yaml`, `.gitignore`). Publishing a GitHub Release with a zip of `backups/<tenant>/` at manual backup time gives a one-click download aligned with how operators already think about backup tags as "releases," without changing restore workflow inputs or scheduled fleet behavior.

## What Changes

- **Release helper** — new `scripts/create-backup-release.sh` zips `backups/<tenant>/` and publishes a GitHub Release on the backup tag via `gh release create`
- **Manual backup workflow** — `backup.yml` invokes the helper after a successful commit and tag push (unchanged backups skip release, same as today)
- **Tag retention** — ISC Prune Tags deletes GitHub Releases whose tag matches pruned backup tags
- **Tests** — assert zip contains tenant backup JSON, excludes branch metadata; workflow reference test asserts helper usage
- **README** — document that manual backup publishes a downloadable release

**Manual backup restore-point delivery**
- From: tag pushed; no GitHub Release; no dedicated zip asset
- To: tag pushed plus GitHub Release with `<tenant>-<timestamp>.zip` containing `backups/<tenant>/`
- Reason: operators need a clean downloadable bundle from the Releases UI
- Impact: non-breaking; restore still uses tag ref; scheduled backups unchanged

## Capabilities

### New Capabilities

_(none — extend existing backup and retention capabilities)_

### Modified Capabilities

- `backup`: manual ISC Backup workflow SHALL publish a GitHub Release with a zipped backup asset when a new restore-point tag is created
- `backup-tag-retention`: tag pruning SHALL also delete GitHub Releases linked to pruned backup tags

## Impact

- **New files:** `scripts/create-backup-release.sh`, `scripts/test-create-backup-release.mjs`
- **Modified files:** `.github/workflows/backup.yml`, `.github/workflows/prune-tags.yml`, `scripts/test-workflow-references.mjs`, `README.md`
- **GitHub UI:** Releases page gains entries for manual backups; each release includes a zip download of tenant configuration JSON
- **Permissions:** existing `contents: write` on backup and prune workflows covers release create/delete
- **Scheduled backup:** no change — remains tag-only
- **CLI:** no change — release publish is workflow-driven

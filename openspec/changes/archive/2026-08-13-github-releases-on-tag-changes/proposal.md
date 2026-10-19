# Proposal: GitHub Releases Only When Tag Content Changes

## Why

Backup workflows publish a GitHub Release with a downloadable zip after every restore-point tag push, including unchanged nightly runs where ISC configuration matches the previous snapshot. That duplicates entries on the Releases page and wastes Actions time building identical zip assets. Operators still need restore-point tags for pending checks and restore workflows, but GitHub Releases should appear only when the tagged backup content actually changed since the prior restore point for that tenant.

## What Changes

**GitHub Release creation gate**
- From: ISC Backup and Scheduled Backup create a GitHub Release whenever a restore-point tag is pushed, including unchanged backups that tag current HEAD without a branch commit
- To: GitHub Release is created only when the new tag's `backups/` tree differs from the previous restore-point tag's `backups/` tree for the same tenant; first tag for a tenant still gets a release
- Reason: Releases are the operator download surface; unchanged content adds clutter without new restore value
- Impact: non-breaking for restore (tags unchanged); Releases page shows fewer duplicate entries; unchanged tag links may not have a zip asset until the next content-changing backup

**Shared release helper**
- From: `create-backup-release.sh` always calls `gh release create` after building the zip
- To: helper resolves the prior tenant tag, compares tree SHAs, skips release with exit 0 when content is identical
- Reason: single enforcement point for manual and scheduled workflows
- Impact: non-breaking; expected skip is logged, not a warning

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `backup`: GitHub Release requirement — publish only when tagged backup content changed vs previous restore-point tag
- `scheduled-backup`: scheduled matrix release requirement — same content-change gate as manual backup

## Impact

- **Modified files:** `scripts/create-backup-release.sh`, `scripts/test-create-backup-release.mjs`, possibly `scripts/test-workflow-references.mjs`
- **Workflows:** `isc-backup.yml` and `scheduled-backup.yml` keep calling the release helper unchanged (logic moves into script)
- **GitHub UI:** Releases page accumulates entries only for content-changing backups; Tags tab unchanged; restore workflow tag selector unchanged
- **Prune/offboard:** existing release deletion when tags are pruned remains; no backfill of historical duplicate releases
- **CLI:** no change (releases remain workflow-driven)

# Proposal: Make Releases Only the Contents of ./backups

## Why

Backup restore-point tags (`<tenant>/<YYYY-MM-DD_HH-MM-SS>`) currently reference tenant branch commits whose trees include branch metadata (`.tenant.yaml`, `.gitignore`) alongside `backups/<tenant>/`. Operators browse and download these tags from GitHub expecting a clean configuration snapshot, but receive unrelated branch files. Restore only needs `backups/<tenant>/` at the tag ref. Narrowing tagged commits to the `./backups` subtree makes restore points self-describing, reduces confusion in the Tags UI, and avoids leaking branch scaffolding in downloadable archives—without changing tenant branch layout or restore workflow inputs.

## What Changes

- **Shared tag helper** — new script (e.g. `scripts/create-backup-tag.sh`) builds a backups-only commit via `git commit-tree` + `git mktree`, tags it, and pushes with existing retry logic
- **Backup workflows** — `backup.yml` and `scheduled-backup.yml` replace direct `git tag` on branch HEAD with the helper (including unchanged/no-commit tag path)
- **Tests** — assert tagged tree contains `backups/` and excludes `.tenant.yaml` / `.gitignore`
- **README** — document that restore-point tags contain only `./backups`

**Restore-point tag contents**
- From: tag points at tenant branch commit (backups + branch metadata)
- To: tag points at dedicated commit whose root tree contains only `backups/`
- Reason: operators treat tags as releases; snapshot should be backup data only
- Impact: non-breaking for restore (paths unchanged); existing old-shape tags remain until pruned

## Capabilities

### New Capabilities

_(none — refine existing backup tagging behavior)_

### Modified Capabilities

- `backup`: GitHub Actions backup workflow tagging requirement — tags must reference backups-only commits
- `scheduled-backup`: scheduled matrix backup tagging — same backups-only tag semantics for both commit and unchanged paths

## Impact

- **New files:** `scripts/create-backup-tag.sh`, `scripts/test-create-backup-tag.sh` (or extend workflow reference tests)
- **Modified files:** `.github/workflows/backup.yml`, `.github/workflows/scheduled-backup.yml`, `scripts/test-workflow-references.mjs`, `README.md`
- **GitHub UI:** Tags/Releases source download shows only `backups/`; "Use workflow from" tag restore unchanged
- **Git operations:** extra `commit-tree` per tag; branch commits unchanged; tag retention/offboard unaffected
- **CLI:** no change (tagging remains workflow-driven)

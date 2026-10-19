# Brainstorm: Manual Backup Creates Zipped GitHub Release

Raw capture from design exploration (2026-08-05).

## Background

The ISC Backup workflow (`backup.yml`, manual `workflow_dispatch`) exports tenant configuration, commits to the tenant branch, and pushes a UTC timestamp git tag (`<tenant>/<YYYY-MM-DD_HH-MM-SS>`). Operators use these tags as restore points and browse them on the GitHub Tags tab.

There is **no GitHub Release object** created today — no entry on the Releases page and no downloadable zip asset besides GitHub's auto-generated source archive from a tag (which currently includes branch metadata like `.tenant.yaml` and `.gitignore`).

Prior work (`make-releases-backups-only`, in progress) narrows **tag commit trees** to `./backups` only but explicitly scoped out GitHub Release objects. The user now wants manual backup to produce a **zipped release** operators can download from the Releases UI.

Scheduled fleet backups (`scheduled-backup.yml`) remain high-volume and tag-only; release creation is an operator-initiated manual backup concern.

## Decision Chain

### Q1: What does "zipped release" mean?

**Decision:** Create a **GitHub Release** linked to the backup tag, with a **custom zip asset** containing only `backups/<tenant>/`. Release tag name matches the existing backup tag (`<tenant>/<YYYY-MM-DD_HH-MM-SS>`).

**Reason:** Operators asked for Releases-page downloads; a custom zip guarantees clean backup content regardless of whether tag commits are backups-only yet.

**Rejected:** Tag-only with GitHub auto source zip — depends on tag tree shape; may include branch metadata until `make-releases-backups-only` ships.

**Rejected:** Separate standalone release workflow — user wants release creation included in the ISC Backup process.

### Q2: Which backup path creates releases?

**Decision:** **Manual ISC Backup only** (`backup.yml` via `workflow_dispatch`). Scheduled matrix backups continue tag-only.

**Reason:** User explicitly requested manual backup; fleet runs would flood Releases (many tenants × daily).

### Q3: When is a release created?

**Decision:** Only when the backup **commits changes and pushes a new tag** (same gate as today). Unchanged backups (`STATUS=unchanged`) skip tag and release.

**Reason:** No new restore point exists; creating a duplicate release adds no value.

### Q4: How to build and publish the zip?

**Decision:** Shared helper `scripts/create-backup-release.sh <tag-name> <tenant>` that:
1. Zips `backups/<tenant>/` from the current working tree (post-commit)
2. Names asset `<tenant>-<timestamp>.zip`
3. Calls `gh release create "$TAG_NAME" --title "..." --notes "..." <zip-file>` after tag push succeeds

**Reason:** `gh` CLI is available on `ubuntu-latest` runners; `contents: write` permission covers releases; keeps workflow YAML thin.

**Rejected:** GitHub REST API from Node — unnecessary dependency for a single workflow step.

**Rejected:** Zip entire `backups/` tree — tenant folder only keeps archives small and unambiguous.

### Q5: Release retention when tags are pruned?

**Decision:** Extend **ISC Prune Tags** (`prune-tags.yml`) to delete GitHub Releases whose tag matches a pruned backup tag (same 7-newest retention rule per tenant prefix).

**Reason:** Orphan releases accumulate if tags are deleted without cleaning releases; tag and release should stay paired.

### Q6: CLI parity?

**Decision:** **No CLI change.** Release creation remains workflow-driven (same as tag push today). Document in README.

### Q7: Failure handling?

**Decision:** Release creation failures are **non-fatal** (warning annotation), mirroring `push-backup-tag.sh` — branch commit and tag hold the backup; release is a convenience download surface.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Releases only for manual backup; scheduled tags without releases | Intended — operator-initiated download UX |
| Custom zip duplicates git content already in tag/branch | Small cost; guarantees clean download bundle |
| Prune-tags workflow gains release API calls | Necessary to avoid stale Releases page clutter |
| Release step depends on `gh` CLI on runner | Standard on GitHub-hosted runners; pin behavior in tests via script contract |

## Capability Fit (existing openspec/specs/)

- Modify **backup** — add GitHub Release requirement for manual workflow success path
- Modify **backup-tag-retention** — prune associated GitHub Releases when backup tags are deleted
- No new capability — release publishing is an extension of backup restore-point delivery

## Validated Scope for Proposal

**In scope:**
- `scripts/create-backup-release.sh` — zip tenant backup folder, publish GitHub Release
- Update `backup.yml` to call helper after successful tag push
- Extend `prune-tags.yml` / retention script to delete matching GitHub Releases
- Tests for zip contents and workflow references
- README note on manual backup → Releases download

**Out of scope:**
- GitHub Releases for scheduled backups
- CLI local release publish
- Changing tag naming or branch commit layout
- GitHub Release notes automation beyond basic title/body with stats

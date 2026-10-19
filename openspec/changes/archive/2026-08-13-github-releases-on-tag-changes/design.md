## Context

ISC Config Hub pushes restore-point tags (`<tenant>/<YYYY-MM-DD_HH-MM-SS>`) after every successful backup run. Tags reference backups-only commits suitable for restore and pending checks. Since scheduled backups gained GitHub Release publishing, both `isc-backup.yml` and `scheduled-backup.yml` call `create-backup-release.sh` after every tag push — including unchanged runs that skip the branch commit but still tag current HEAD.

Each release builds a zip and calls `gh release create`. Unchanged nightly runs produce duplicate Releases entries with identical backup content, cluttering the Releases UI and consuming Actions minutes. Tags must continue to be created on unchanged runs; only the Release object is redundant when backup content matches the prior restore point.

Constraints: non-fatal auxiliary steps; shared shell helper pattern; GitHub UI first; existing tag naming and retention unchanged; no CLI surface for releases.

## Goals / Non-Goals

**Goals:**

- Publish GitHub Releases only when a new restore-point tag carries backup content that differs from the tenant's previous restore-point tag
- Enforce the gate in `create-backup-release.sh` so manual and scheduled workflows stay aligned without duplicate YAML conditions
- Preserve tag push behavior, restore workflow inputs, prune/offboard release cleanup, and non-fatal failure handling for actual release API errors
- Add automated tests for skip vs publish paths

**Non-Goals:**

- Changing when tags are pushed or how pending checks work
- Backfilling or deleting historical duplicate releases
- Changing dashboard tag link URLs
- CLI local release publishing
- Comparing zip bytes instead of git tree identity

## Decisions

### D1: Keep tags on unchanged backups; gate releases only

- **Choice:** Continue pushing restore-point tags for unchanged backups; skip GitHub Release when content is unchanged
- **Reason:** Tags drive pending semantics and restore refs; releases are the download convenience layer
- **Considered alternatives:** Skip tag on unchanged (breaks pending/retry flows); delete previous release (unnecessary API churn)

### D2: Compare `backups/` tree SHA at tag refs

- **Choice:** Before building the zip, resolve the previous tenant tag (by embedded UTC timestamp, excluding the current tag) and compare `git rev-parse "${TAG}:backups"` tree SHAs. Equal → skip release with exit 0 and informational log. No previous tag → publish release
- **Reason:** Matches operator intent ("changes from previous contents") at the tag ref where restore and download occur; avoids zip build when skipping
- **Considered alternatives:** Workflow `STATUS=backed-up` gate (couples to branch diff, not tag content); byte-level zip diff (slower, redundant)

### D3: Previous-tag resolution in bash via git tag listing

- **Choice:** List `git tag -l "${TENANT}/*"`, parse embedded timestamp suffix (same pattern as `parseTagTimestamp` in `parse-tenants.mjs`), sort descending, exclude `TAG_NAME`, take first match as previous tag
- **Reason:** Consistent with fleet pending/tag logic; no new Node dependency in the shell helper; works in Actions after tag push when refs are local
- **Considered alternatives:** Extract shared Node module (overkill for one comparison); `creatordate` sort (wrong after branch squash / retag edge cases)

### D4: Skip is success, not warning

- **Choice:** Content-unchanged skip logs `Backup content unchanged vs <prev-tag> — skipping release` and exits 0 without `::warning::`
- **Reason:** Unchanged nightly runs are expected; warnings should remain for API failures only
- **Considered alternatives:** Warning annotation (noise); failing the step (would break backup success semantics)

### D5: Workflows unchanged at YAML level

- **Choice:** Both workflows keep `Publish backup release` step with `if: env.TAG != ''`; all gating lives in the helper
- **Reason:** Single enforcement point; avoids drift between manual and scheduled paths
- **Considered alternatives:** Duplicate `STATUS=backed-up` conditions in YAML (partial, harder to test)

## Risks / Trade-offs

- [Risk] Previous-tag lookup fails (no git tags fetched) → Mitigation: treat missing previous tag as "first backup" and publish release; log clearly
- [Risk] Tag just pushed not yet visible to `git rev-parse` → Mitigation: comparison uses local ref created by tag step in same job; use `TAG_NAME` ref explicitly
- [Trade-off] Unchanged tags have no GitHub Release zip asset → Accepted: tag page still works for restore; next content-changing backup creates release
- [Trade-off] Spec reverses recent "unchanged still creates release" requirement → Accepted: explicit user request

## Migration Plan

1. Merge helper change to `main` — takes effect on next backup run; no migration script
2. Existing duplicate releases remain until pruned by tag retention or manual cleanup
3. Rollback: revert `create-backup-release.sh` to always publish; workflows unchanged
4. Acceptance: unchanged scheduled backup pushes tag but logs skip and does not call `gh release create`; content-changing backup creates release with zip asset

## Open Questions

_(none — scope is fully defined)_

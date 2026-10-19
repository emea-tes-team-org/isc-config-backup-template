# Design: Keep Latest Tag When Offboarding a Tenant

## Context

Tenant offboard (`scripts/offboard.mjs`) removes the registry entry, deletes all `<tenant>/*` tags, squashes the tenant branch to one commit, and sets `active: false`. Tag deletion uses `deleteMatchingTags()` with no retention logic. Elsewhere, the platform already ranks backup tags by name-embedded UTC timestamp via `parseTagTimestamp()` in `parse-tenants.mjs` and applies retention in `prune-tags.mjs`. Manual backups may attach GitHub Releases to tags via `create-backup-release.sh`.

Stakeholders: operators running ISC Offboard from GitHub Actions or CLI; auditors referencing Tags/Releases for last backup before decommission.

## Goals / Non-Goals

**Goals:**
- Preserve exactly one backup tag per offboarded tenant — the latest by embedded timestamp
- Delete older tenant tags and their GitHub Releases during offboard
- Keep CLI and workflow behavior identical
- Export testable helpers (tag selection, prune list) from `offboard.mjs`

**Non-Goals:**
- Re-pointing the kept tag to the post-squash commit
- Changing weekly ISC Prune Tags behavior for active tenants
- Deleting the kept tag's GitHub Release
- Modifying offboard registry, branch squash, or environment semantics

## Decisions

### 1. Latest tag selection

- **Choice:** Reuse `parseTagTimestamp()` from `parse-tenants.mjs`; among tags matching `<tenant>/` prefix with valid timestamps, keep the tag with maximum timestamp; ties broken by lexicographic max on full tag name
- **Reason:** Consistent with pending checks, dashboard, and prune-tags; no duplicate parsing logic
- **Alternatives:** Creatordate-based (rejected — spec explicitly prefers embedded timestamp); keep 7 tags (rejected — offboard is decommission, not retention)

### 2. Invalid or non-backup tags

- **Choice:** Tags under `<tenant>/` that fail `parseTagTimestamp()` are deleted; they are not eligible to be kept
- **Reason:** Only standardized backup tags are restore points; stray tags should not block cleanup

### 3. GitHub Release deletion

- **Choice:** For each deleted tag, call release delete (same non-fatal pattern as `prune-tags.mjs`); skip release delete for kept tag
- **Reason:** Avoid orphaned releases pointing at deleted tags; preserve release asset on latest tag when present
- **Alternatives:** Leave releases (confusing — release tag missing); delete all releases including latest (rejected)

### 4. Function shape

- **Choice:** Replace `deleteMatchingTags` usage with new exported helpers:
  - `selectLatestTenantTag(tags, tenant)` → tag name or null
  - `tagsToDeleteOnOffboard(tags, tenant)` → tags to delete (all tenant tags minus latest valid backup tag)
  - `pruneTenantTagsOnOffboard(tenant, allTags, deleteTagFn, releaseDeleteFn)` → `{ kept, deleted }`
- **Reason:** Unit-testable without git; mirrors prune-tags structure

### 5. Logging

- **Choice:** Log kept tag when present; log count of deleted tags; warn on release delete failure
- **Reason:** Operator visibility in Actions log

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Kept tag references pre-squash commit | README note: branch HEAD is post-offboard snapshot; tag is last restore-point before decommission |
| Shared helper import from prune-tags creates coupling | Import `deleteReleaseForTag` if exported; otherwise duplicate minimal 10-line helper |
| Offboard with only invalid `<tenant>/foo` tags deletes all | Documented; invalid tags are not restore points |

## Migration Plan

1. Ship script + test changes (no workflow YAML change)
2. Existing offboarded tenants already have zero tags — no backfill
3. Future offboards retain one tag automatically
4. Rollback: revert `offboard.mjs` to delete all tags (operators may manually delete remaining tag)

## Open Questions

_(none — scope is fully defined)_

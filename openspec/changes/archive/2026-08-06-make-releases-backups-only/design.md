# Design: Backups-Only Restore-Point Tags

## Context

ISC Config Hub stores tenant configuration under `backups/<tenant>/` on per-tenant git branches. Backup workflows push branch commits and create UTC timestamp tags for restore points. Tags are the operator-facing "release" surface in GitHub (alongside the Tags tab and restore workflow ref selector).

Branch commits intentionally include `.tenant.yaml` and branch-specific `.gitignore` for onboarding and tokenization workflows. Tagging branch HEAD therefore publishes non-backup files in tag archives. Restore resolves `backups/<tenant>/...` via `git cat-file` and does not depend on branch metadata at the tag ref.

Constraints: branch-per-tenant model (ADR 0001), GitHub UI first, CLI parity where tagging exists (today: Actions only), existing tag retention (7 newest per prefix) and offboard tag deletion must keep working unchanged.

## Goals / Non-Goals

**Goals:**
- Each new backup tag points at a commit whose tree contains **only** the `backups/` directory
- Tenant branch commits and history remain unchanged
- Restore from tag continues to work without workflow or CLI changes
- Shared helper used by both manual and scheduled backup workflows

**Non-Goals:**
- Creating GitHub Release objects or upload assets
- Retagging or rewriting existing remote tags
- Changing tenant branch file layout
- Adding CLI tag push for local backups

## Decisions

### D1: Separate tag commit from branch commit

- **Choice:** Create a new commit via `git commit-tree` for each tag; branch HEAD stays the operational tenant commit
- **Reason:** Minimizes blast radius; tokenize/drift/onboarding continue checking out tenant branches as today
- **Considered alternatives:** Tag branch HEAD (status quo — rejected); make branch commits backups-only (breaks metadata — rejected)

### D2: Preserve `backups/` path prefix at tag root

- **Choice:** Build root tree with single entry `backups/` → subtree from `HEAD:backups` using `git mktree`
- **Reason:** Restore and stats scripts expect `backups/<tenant>/...` paths at any git ref
- **Considered alternatives:** Tag the `HEAD:backups` tree as commit root (paths become `<tenant>/...` — rejected)

### D3: Shared shell helper orchestrates tag + push

- **Choice:** `scripts/create-backup-tag.sh <tag-name> [source-ref]` creates backups-only commit, tags, calls `push-backup-tag.sh`
- **Reason:** DRY across `backup.yml` and `scheduled-backup.yml`; keeps retry/non-fatal push behavior
- **Considered alternatives:** Inline bash in both workflows (duplicate — rejected); Node script (unnecessary — git plumbing is shell-native)

### D4: Apply to unchanged backup path

- **Choice:** Scheduled backup's "no changes but tag HEAD" path uses the same helper against current branch tip
- **Reason:** Every restore-point tag must have backups-only tree regardless of whether branch got a new commit

### D5: No migration of legacy tags

- **Choice:** Only new tags after deploy use backups-only commits; prune-tags retires old-shape tags within retention window
- **Reason:** Rewriting remote tag history is risky and unnecessary

## Risks / Trade-offs

- [Risk] Tag commit orphaned from branch history → **Mitigation:** Expected; tags are access refs; document in README
- [Risk] `HEAD:backups` missing on branch tip → **Mitigation:** Helper fails fast with clear error (backup workflows only tag after successful backup fetch)
- [Trade-off] Two commits worth of object storage per tagged backup (branch + tag) → **Accept:** Small; tag tree shares blob objects with branch commit
- [Trade-off] Existing tags remain full-tree until pruned → **Accept:** ≤7 tags per tenant under retention

## Migration Plan

1. Merge helper script + tests
2. Update both backup workflows to call helper instead of `git tag` on HEAD
3. Extend `test-workflow-references.mjs` to assert helper usage
4. Document tag contents in README
5. **Rollback:** Revert workflows to tag branch HEAD; new backups-only tags can remain (harmless) or be pruned manually

No downtime; next scheduled/manual backup produces new-shape tags.

## Open Questions

_(none — scope validated in brainstorm)_

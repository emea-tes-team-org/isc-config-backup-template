# Design: Backup Tag Retention

## Context

ISC Config Hub creates a git tag on every successful backup: `<tenant>/<YYYY-MM-DD_HH-MM-SS>` (UTC). Tags serve as point-in-time restore refs in the ISC Restore workflow. Offboard deletes all tags for a decommissioned tenant, but active and inactive tenants accumulate tags indefinitely.

The codebase already parses tag timestamps from the tag **name** in `scripts/parse-tenants.mjs` (`parseTagTimestamp`) — this must be reused for retention sorting, not git creatordate (squashed branches can share creatordates). Tag listing and deletion patterns exist in `scripts/offboard.mjs`.

Operators confirmed: retain **7 latest restore points** per tenant prefix, prune **all remote tags** (including orphans), run **weekly on Sunday 03:00 UTC**.

## Goals / Non-Goals

**Goals:**
- Weekly scheduled GitHub Action that prunes backup tags to 7 newest per tenant prefix
- `workflow_dispatch` with `dry_run` for first-run verification and ad-hoc inspection
- Pure-function core logic with unit tests (`scripts/test-prune-tags.mjs`)
- Step summary reporting kept/deleted counts per tenant prefix
- Reuse `parseTagTimestamp` from `parse-tenants.mjs`

**Non-Goals (v1):**
- Configurable retention count via workflow input
- CLI mirror (`cli.mjs` route)
- Branch history squash or commit deletion
- Calendar-day-based retention (dedupe by date)
- Deleting malformed/non-backup tags
- GitHub Releases management

## Decisions

### D1: Retention unit is tag count, not calendar days

- **Choice:** Keep the 7 tags with the greatest name-embedded timestamps per prefix
- **Reason:** Matches operator intent ("7 latest restore points"); retry backups may create multiple tags per day
- **Considered alternatives:** Keep latest tag per calendar day for 7 days — rejected; more complex, not requested

### D2: Scope is all remote tag prefixes

- **Choice:** Group every tag matching `<prefix>/YYYY-MM-DD_HH-MM-SS` by prefix; do not filter by `tenants.yaml`
- **Reason:** Hygiene for orphan tags; registry membership is irrelevant to retention
- **Considered alternatives:** Only active tenants in registry — rejected; leaves clutter from offboard gaps or manual edits

### D3: Weekly schedule at Sunday 03:00 UTC

- **Choice:** Cron `0 3 * * 0`
- **Reason:** Scheduled backups run midnight UTC with retries until ~01:45 UTC; Sunday 03:00 avoids racing with Saturday night's backup window
- **Considered alternatives:** Daily prune — rejected; user chose weekly after exploration

### D4: Dedicated script, not extension of offboard

- **Choice:** New `scripts/prune-tags.mjs` with exported pure functions
- **Reason:** Offboard deletes all tags (total decommission); retention is partial delete with different semantics and batch scale
- **Considered alternatives:** Add `--keep N` to offboard — rejected; conflates unrelated operations

### D5: Sort by name-embedded timestamp

- **Choice:** Import and use `parseTagTimestamp` from `parse-tenants.mjs`
- **Reason:** Consistent with backup-pending-check and schedule-aware-parser; immune to creatordate anomalies after branch squash
- **Considered alternatives:** `git tag --sort=-creatordate` — rejected; known bug class in this repo

### D6: Skip malformed tags

- **Choice:** Tags that fail `parseTagTimestamp` are excluded from sort/delete
- **Reason:** Avoid accidental deletion of non-backup tags that happen to match `<something>/<rest>` pattern partially
- **Considered alternatives:** Delete malformed tags as junk — rejected; safer to skip

### D7: Batch tag deletion pushes

- **Choice:** Chunk deleted tags into batched `git push origin :refs/tags/t1 :refs/tags/t2 ...` calls (~50–100 refspecs per push)
- **Reason:** Offboard's one-push-per-tag pattern is fine for small sets; first prune on mature tenants may delete dozens of tags
- **Considered alternatives:** One push per tag — rejected; slow and wasteful of Actions minutes

### D8: Dry-run via workflow input

- **Choice:** `workflow_dispatch` input `dry_run` (boolean); when true, log and summarize without pushing deletions
- **Reason:** First run on mature repo deletes many tags; operators need safe verification
- **Considered alternatives:** Separate dry-run workflow — rejected; unnecessary duplication

### D9: Concurrency guard

- **Choice:** `concurrency: group: prune-tags, cancel-in-progress: true`
- **Reason:** Prevent overlapping manual and scheduled runs
- **Considered alternatives:** None — standard pattern from scheduled-backup

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  .github/workflows/prune-tags.yml                           │
│  cron: 0 3 * * 0  |  workflow_dispatch (dry_run)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  scripts/prune-tags.mjs                                     │
│  1. listRemoteTags()                                        │
│  2. groupByTenantPrefix()                                   │
│  3. selectTagsToDelete(tags, keep=7)  ← parseTagTimestamp   │
│  4. deleteRemoteTagsBatch()  (skip if dry_run)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   parse-tenants.mjs              offboard.mjs patterns
   (parseTagTimestamp)            (list/delete remote tags)
```

## Risks / Trade-offs

- [Risk] Tag deletion is irreversible → Mitigation: dry-run mode; step summary lists deleted tags; document restore window in README
- [Risk] First run deletes many tags on mature tenants → Mitigation: recommend manual dry-run before enabling schedule; step summary shows counts
- [Risk] Concurrent backup creates tag during prune → Mitigation: schedule after backup window; concurrency group
- [Trade-off] ~7–14 tags accumulate between weekly runs → Accepted; steady state for daily-backup tenants
- [Trade-off] Restore limited to 7 newest tag refs → Accepted; operator confirmed intent
- [Trade-off] No CLI mirror in v1 → Accepted; GitHub Actions is primary UX per project principles

## Migration Plan

1. Implement `scripts/prune-tags.mjs` and unit tests
2. Add `.github/workflows/prune-tags.yml` with schedule disabled initially OR run first `workflow_dispatch` with `dry_run: true`
3. Review dry-run step summary for expected deletions
4. Run manual `workflow_dispatch` without dry-run to perform initial catch-up prune
5. Enable weekly cron (included in workflow from start — no separate enable step)
6. Document retention policy in README

**Rollback:** Disable workflow schedule or delete workflow file; cannot restore deleted tags without GitHub support/reflog recovery

## Open Questions

None — all decisions validated in brainstorm session.

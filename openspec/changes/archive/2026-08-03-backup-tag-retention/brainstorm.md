# Brainstorm: Backup Tag Retention

Raw capture from design exploration session (2026-08-03).

## Background

Each successful backup creates a git tag named `<tenant>/<YYYY-MM-DD_HH-MM-SS>` (UTC). Tags accumulate indefinitely on the remote repository — there is no automated retention today. The only tag cleanup path is **Offboard**, which deletes *all* tags for a decommissioned tenant.

Operators use tags as restore refs via the ISC Restore workflow ("Use workflow from" dropdown). The codebase already parses tag timestamps from the tag **name** (not git creatordate) in `scripts/parse-tenants.mjs` — important because squashed branches can share creatordates across tags.

Existing reusable pieces:
- `offboard.mjs`: `listRemoteTags()`, `listTenantTags()`, `deleteRemoteTag()`
- `parse-tenants.mjs`: `parseTagTimestamp()`, `buildLatestTagMapFromTags()`

## Decision Chain

### Q1: What does "7" mean?

**Decision:** **7 latest restore points** per tenant — the seven tags with the greatest name-embedded timestamps. Not 7 calendar days.

**Implication:** Retry backups that create multiple tags on the same day each count as separate restore points. A tenant with frequent retries may retain fewer calendar days of history within the 7-tag window.

### Q2: Which tenants/tags are in scope?

**Decision:** **All tags on the remote** — group by tenant prefix (everything before the first `/`). Includes active tenants, inactive (schedule-toggled) tenants, and orphaned prefixes no longer in `tenants.yaml`.

**Rejected:** Registry-only scope — would leave orphan tag clutter forever.

### Q3: Daily or periodic schedule?

**Decision (revised):** **Weekly**, not daily. User initially considered daily but chose weekly after weighing steady-state behavior (daily backups add ~7 tags/week; weekly prune is sufficient).

### Q4: Which day/time for the weekly run?

**Decision:** **Sunday 03:00 UTC** (`0 3 * * 0`).

**Rationale:** Scheduled backups run midnight UTC with retries until ~01:45 UTC daily. Sunday 03:00 UTC provides a ~25-hour buffer after Saturday night's backup window and avoids racing with tag creation.

### Q5: Configurable retention count?

**Decision:** **Hardcode 7** for v1. No workflow input or env var unless needed later.

### Q6: Dry-run / manual trigger?

**Decision:** Include **`workflow_dispatch`** with optional **`dry_run`** input for first-run verification and ad-hoc inspection. Scheduled weekly run performs actual deletion.

### Q7: Malformed tags (no embedded timestamp)?

**Decision:** **Skip** tags that do not match `<tenant>/YYYY-MM-DD_HH-MM-SS`. Do not delete unknown-format tags automatically — avoids accidental removal of non-backup tags.

### Q8: Implementation shape?

**Decision:** New **`scripts/prune-tags.mjs`** (not bolted onto `offboard.mjs` — different semantics: partial vs total delete). New **`.github/workflows/prune-tags.yml`**. Unit tests in **`scripts/test-prune-tags.mjs`**.

**Reuse:** Import `parseTagTimestamp` from `parse-tenants.mjs`. Share tag list/delete helpers with offboard or extract minimal shared utilities if duplication is awkward.

**Performance:** Batch tag deletion refspecs in chunked `git push` calls (not one push per tag as offboard does — acceptable for offboard's small sets, inefficient for bulk prune).

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Tag deletion is irreversible | Intended — old restore points disappear from GitHub UI; branch commits may still exist on tenant branch |
| ~7–14 tags accumulate between weekly runs | Acceptable — steady state for daily-backup tenants; first run on mature repo deletes all but newest 7 per prefix |
| Restore window ≈ 1 week for daily tenants | User confirmed 7 restore points is the intended RPO for tag-based restore |
| Orphan prefixes get pruned too | Hygiene benefit; offboard still deletes all tags on decommission |
| Weekly vs daily | Less Actions minutes; slightly more tag clutter between runs |

## Capability Fit (existing openspec/specs/)

- New capability: **backup-tag-retention** — weekly automated prune of backup tags
- Related: **tenant-offboarding** (total tag delete on offboard — orthogonal)
- Related: **backup-pending-check** / **ubiquitous-language** (tag naming convention — must use name-embedded timestamp for sort)
- Related: **platform-integration** (new GitHub Actions workflow)

## Validated Scope for Proposal

**In scope:**
- `scripts/prune-tags.mjs` with exported pure functions for testing
- `scripts/test-prune-tags.mjs`
- `.github/workflows/prune-tags.yml` — weekly cron + workflow_dispatch with dry_run
- README workflow documentation
- Delta spec with Gherkin scenarios

**Out of scope (v1):**
- Configurable retention count via workflow input
- Branch history squash or commit deletion (tags only)
- GitHub Releases
- Pruning based on calendar days instead of tag count
- CLI mirror (optional future — GitHub Actions is primary UX per project principles)

# Brainstorm: Keep Latest Tag When Offboarding a Tenant

## Problem

ISC Offboard currently deletes **all** git tags matching `<tenant>/*`. Operators lose the named restore-point tag that identifies the last successful backup, even though offboard already preserves the tenant branch as a squashed snapshot. Restore workflows accept either a branch ref or a tag ref; tags are the primary operator surface on the GitHub Tags tab and align with backup audit (timestamp in tag name).

After offboard, operators who want a portable restore reference must rely on branch HEAD alone. Manual backups may also have published a GitHub Release on the latest tag — deleting every tag removes that release asset too.

## Context

- `scripts/offboard.mjs` calls `deleteMatchingTags()` which deletes every remote tag with prefix `<tenant>/`
- Latest-tag selection already exists in `scripts/parse-tenants.mjs` (`parseTagTimestamp`, `buildLatestTagMapFromTags`) and `scripts/prune-tags.mjs` (retention by embedded timestamp)
- Specs (`tenant-offboarding`, `tenant-lifecycle`, `platform-integration`) require deleting all tenant backup tags on offboard
- Offboard otherwise unchanged: registry removal, branch squash, `active: false`, environment preserved

## Clarifications

### Q1: What counts as "latest" tag?

**Decision:** The backup tag with the **greatest name-embedded UTC timestamp** among tags matching `<tenant>/YYYY-MM-DD_HH-MM-SS`, using the same `parseTagTimestamp()` logic as scheduled-backup pending checks and tag retention. Tags that do not parse as backup tags are still deleted (not candidates to keep).

### Q2: Keep one tag or up to seven (retention policy)?

**Decision:** **Keep exactly one** — the latest restore-point tag only. Offboard is decommissioning, not ongoing retention; one tag is enough for audit and restore reference without leaving a week of history on an inactive tenant.

### Q3: Delete GitHub Releases for pruned tags?

**Decision:** **Yes** — when deleting stale tags during offboard, also delete GitHub Releases for those tags (reuse `deleteReleaseForTag` pattern from `prune-tags.mjs`). **Keep** the release on the latest tag if one exists.

### Q4: Tenant with no backup tags?

**Decision:** **No change** — skip tag deletion step; proceed with registry removal and branch squash as today.

### Q5: Tenant with only one tag?

**Decision:** **Keep it** — no tags deleted.

### Q6: CLI and workflow parity?

**Decision:** **Same behavior** — both paths delegate to `offboard.mjs`; no workflow-only logic.

### Q7: Interaction with ISC Prune Tags?

**Decision:** Offboarded tenants are removed from `tenants.yaml`; weekly prune only processes registered tenants. The single preserved tag remains until an operator manually deletes it — acceptable archival footprint.

## Approaches considered

| Approach | Pros | Cons |
|----------|------|------|
| **A. Keep latest tag, delete rest (recommended)** | Restore-point preserved; aligns with branch snapshot intent; minimal tag clutter | One tag remains on inactive tenant |
| B. Keep all tags | Full history | Defeats original offboard tag-cleanup goal; Tags tab clutter |
| C. Keep latest tag + re-point to squashed commit | Tag content matches squash | Requires force-moving tag ref; complex; tag may not match pre-squash tree |

**Recommendation:** Approach A — reuse existing timestamp parsing; delete releases for pruned tags only.

## Risks accepted

| Risk | Mitigation |
|------|------------|
| Preserved tag points at pre-squash commit while branch is squashed | Document that branch HEAD is authoritative post-offboard; tag is archival restore-point for pre-offboard state |
| Invalid tag names deleted even if only tag | Only valid backup-pattern tags are keep candidates; invalid tags cleaned up |
| Release delete fails | Non-fatal warning (same as prune-tags) |

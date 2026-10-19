# Design: Manual Backup Zipped GitHub Release

## Context

ISC Config Hub stores tenant configuration under `backups/<tenant>/` on per-tenant git branches. The manual ISC Backup workflow (`backup.yml`) runs on `workflow_dispatch`, commits changes, tags with `<tenant>/<YYYY-MM-DD_HH-MM-SS>`, and pushes via existing retry helpers. Scheduled fleet backups use the same tag convention but run at high volume across many tenants.

Operators refer to backup tags as "releases" but today only git tags exist — no GitHub Release objects or dedicated zip assets on the Releases page. A sibling change (`make-releases-backups-only`) may narrow tag commit trees to `./backups` only; this change adds explicit GitHub Releases with a custom zip so downloads are clean regardless of tag tree shape.

Constraints: branch-per-tenant model (ADR 0001), GitHub UI first, manual backup only (not scheduled), existing tag retention (7 newest per prefix), non-fatal push semantics for auxiliary steps.

## Goals / Non-Goals

**Goals:**
- Manual ISC Backup publishes a GitHub Release on the backup tag with a zip of `backups/<tenant>/`
- Release creation runs only when a new tag is pushed (backup had changes)
- Tag retention prunes matching GitHub Releases when backup tags are deleted
- Release failures are non-fatal (backup data remains on branch + tag)

**Non-Goals:**
- GitHub Releases for scheduled matrix backups
- CLI release publish for local backups
- Changing tag naming, branch layout, or restore workflow inputs
- Rich release notes / changelog generation beyond basic metadata

## Decisions

### D1: Custom zip asset instead of auto-generated source archive

- **Choice:** Build `<tenant>-<timestamp>.zip` from `backups/<tenant>/` in the workflow workspace and upload as release asset
- **Reason:** Guarantees download contains only configuration JSON; independent of tag commit tree shape
- **Considered alternatives:** `gh release create` with auto source zip from tag — rejected until all tags are backups-only; zip entire repo — rejected

### D2: Manual backup workflow only

- **Choice:** Integrate release step in `backup.yml` only; leave `scheduled-backup.yml` tag-only
- **Reason:** User request scoped to manual backup; fleet releases would clutter Releases page
- **Considered alternatives:** All backups create releases — rejected (volume, noise)

### D3: Shared shell helper orchestrates zip + release

- **Choice:** `scripts/create-backup-release.sh <tag-name> <tenant> [stats-json]` creates zip, calls `gh release create`
- **Reason:** DRY, testable contract, keeps workflow YAML thin; `gh` available on hosted runners
- **Considered alternatives:** Inline workflow bash — duplicate risk; Node script — unnecessary for zip + gh

### D4: Release gated on new tag (changed backup)

- **Choice:** Invoke helper only when `STATUS=backed-up` and `TAG` is set — same condition as tag push today
- **Reason:** Unchanged runs have no new restore point; duplicate release adds no value

### D5: Non-fatal release failures

- **Choice:** Helper exits 0 with `::warning::` on `gh release create` failure, mirroring `push-backup-tag.sh`
- **Reason:** Branch commit and tag are authoritative; release is convenience download surface

### D6: Extend tag retention to delete releases

- **Choice:** When prune-tags deletes a backup tag, also `gh release delete <tag>` (ignore if missing)
- **Reason:** Keeps Releases page aligned with retained restore points; avoids orphan releases

## Risks / Trade-offs

- [Risk] Large tenants produce large zip uploads → **Mitigation:** zip only tenant subtree; same data already in git; monitor workflow timeout (15 min limit)
- [Risk] `gh release delete` fails for releases without tags → **Mitigation:** delete by tag name; ignore 404
- [Trade-off] Manual backups only get Releases; scheduled restore points tag-only → **Accept:** matches operator intent
- [Trade-off] Duplicate storage (git + zip asset) → **Accept:** convenience for non-git consumers

## Migration Plan

1. Merge release helper + tests
2. Update `backup.yml` to call helper after tag push
3. Extend prune-tags workflow/script for release deletion
4. Document manual backup → Releases in README
5. **Rollback:** Remove workflow step; existing releases remain until manually deleted

No downtime; next manual backup with changes produces first release.

## Open Questions

_(none — scope validated in brainstorm)_

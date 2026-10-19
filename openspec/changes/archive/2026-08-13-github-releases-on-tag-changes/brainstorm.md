# Brainstorm: GitHub Releases Only When Tag Content Changes

Raw capture from design exploration (2026-08-13).

## Background

Backup workflows (`isc-backup.yml`, `scheduled-backup.yml`) export ISC configuration, commit changes to tenant branches when needed, and always push a restore-point git tag (`<tenant>/<YYYY-MM-DD_HH-MM-SS>`) whose commit tree contains only `backups/`. After each tag push, `create-backup-release.sh` publishes a GitHub Release with a zip asset of `backups/<tenant>/`.

Current specs require a GitHub Release **whenever a tag is pushed**, including unchanged nightly runs that skip the branch commit but still tag current HEAD. The CHANGELOG documents this as intentional for scheduled backups. That floods the Releases page with duplicate zip assets when configuration has not changed since the previous restore point.

Operators use tags for restore (`isc-restore.yml` tag selector) and Releases for downloadable zips. Tags remain valuable as timestamped restore refs even when content is unchanged; releases are the expensive, human-facing download surface that should reflect **new** backup content only.

Prior manual-backup brainstorm (2026-08-05) originally scoped releases to backups with committed changes only; later work extended releases to scheduled and unchanged tag paths.

## Decision Chain

### Q1: What should still happen on unchanged backups?

**Decision:** **Keep pushing restore-point tags** on unchanged backups (existing behavior). **Skip GitHub Release creation** when the new tag's backup content is identical to the previous restore-point tag for that tenant.

**Reason:** Pending-check and operator visibility depend on tags; releases are redundant when the zip would match the prior release's content.

**Rejected:** Skip tag on unchanged — breaks pending semantics and retry-after-missing-tag flows.

**Rejected:** Delete previous release when unchanged — unnecessary API churn; simply do not create a new one.

### Q2: How is "changes from the previous contents" determined?

**Decision:** Compare the **`backups/` tree SHA** at the new tag against the **`backups/` tree SHA** at the tenant's **previous restore-point tag** (latest `<tenant>/*` tag by embedded UTC timestamp, excluding the tag being published). If equal, skip release. If no prior tag exists, publish release (first restore point).

**Reason:** Matches the operator meaning of "new backup content" at the tag ref, independent of branch metadata or whether the branch commit was skipped. Single enforcement point in `create-backup-release.sh` covers manual and scheduled workflows.

**Rejected:** Workflow-only gate on `STATUS=backed-up` — correct for most runs but couples release policy to branch diff rather than tag content; harder to test in isolation.

**Rejected:** Byte-level zip comparison — slower and redundant when git tree SHAs already capture content identity.

### Q3: Which workflows are affected?

**Decision:** **Both** ISC Backup (`isc-backup.yml`) and Scheduled Backup Matrix (`scheduled-backup.yml`). Same helper, same skip semantics.

**Reason:** Both currently invoke `create-backup-release.sh` on every pushed tag; the fix belongs in shared logic.

### Q4: Operator feedback when release is skipped?

**Decision:** Log an informational line and exit 0 from the release helper (e.g. `Backup content unchanged vs <prev-tag> — skipping release`). No workflow failure, no warning annotation (skip is expected, not an error).

**Reason:** Unchanged nightly runs are normal; warnings would train operators to ignore annotations.

### Q5: Dashboard / README tag links?

**Decision:** **No change** to dashboard tag links (`/releases/tag/<tag>`). GitHub serves tag pages even without a Release object; operators with content-changing backups still get releases and zip assets. Unchanged tags remain valid restore refs without a separate Release entry.

**Out of scope:** Retargeting dashboard links to `/tree/<tag>` vs `/releases/tag/<tag>`.

### Q6: Prune-tags and offboard behavior?

**Decision:** **Unchanged.** Release deletion still pairs with tag deletion during prune/offboard. Orphan-release cleanup only applies to tags that had releases.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Unchanged tags exist without matching GitHub Release | Intended — tag is restore ref; release is download convenience for new content |
| Tree comparison adds git calls in release helper | Small cost vs duplicate `gh release create` + zip build across fleet |
| Previous-tag lookup must handle tag naming convention | Reuse existing prefix/timestamp parsing patterns from `parse-tenants.mjs` / prune logic |
| Spec reverses recent "unchanged still creates release" requirement | Correct — user explicitly requested the reversal |

## Capability Fit (existing openspec/specs/)

- Modify **backup** — GitHub Release requirement gated on backup content change vs previous tag
- Modify **scheduled-backup** — same release gate for matrix jobs
- No new capability — release gating is an extension of existing restore-point delivery

## Validated Scope for Proposal

**In scope:**
- `scripts/create-backup-release.sh` — resolve previous tenant tag, compare `backups/` tree, skip `gh release create` when unchanged
- Tests in `scripts/test-create-backup-release.mjs` for skip vs publish paths
- Spec deltas for `backup` and `scheduled-backup`
- CHANGELOG entry noting scheduled/manual releases no longer created for unchanged backup content

**Out of scope:**
- Changing when tags are pushed
- CLI local release publish
- Dashboard link URL changes
- Backfill deletion of existing duplicate releases for unchanged tags

# Brainstorm: Tenant Offboard and Schedule Toggle

Raw capture from design exploration session (2026-08-03).

## Background

Operators can onboard tenants via GitHub Actions (`onboarding.yml`) and the local CLI (`scripts/onboard.mjs`), but there is no symmetric operator action to pause backups or decommission a tenant. A partial CLI `--remove` flag exists that drops the registry entry locally without deleting backup tags, squashing branch history, or pushing to `main`.

Backup runs create git tags named `<tenant>/<YYYY-MM-DD_HH-MM-SS>` (user referred to these as "releases" — they appear on the GitHub Tags tab). Each backup also adds a commit on the tenant branch under `backups/<tenant>/`.

The centralized scheduler (`scheduled-backup.yml`) includes tenants where `active: true` in `tenants.yaml`. Setting `active: false` already excludes a tenant from the matrix but requires manual YAML editing.

## Decision Chain

### Q1: What does "unregister" mean?

**Decision:** Split into two distinct operator actions with different blast radius.

1. **Schedule Toggle** — flip `active` in `tenants.yaml`; preserve branch, commits, tags, and registry entry.
2. **Offboard** — decommission: remove from registry, delete all `<tenant>/*` tags, squash branch to a single commit retaining the latest backup snapshot; branch itself stays.

**Rejected:** Single "unregister" action — too ambiguous between pause and decommission.

### Q2: What are "published releases"?

**Decision:** User confirmed they meant **git backup tags**, not GitHub Releases. Tags are the point-in-time restore refs today. GitHub Releases were evaluated and deemed unnecessary unless a non-git consumer needs downloadable bundles.

### Q3: What does "keep only the last commit" mean for offboard?

**Decision:** Squash the tenant branch to one orphan commit whose tree matches the current HEAD (latest backup snapshot). Force-push the tenant branch. Per-backup commit history becomes unreachable; backup JSON at latest state is preserved.

**Rejected:** Keeping full commit history with only tags deleted — user explicitly wanted history collapsed.

### Q4: Schedule Toggle UX — enable/disable inputs or flip?

**Decision:** **Toggle** based on current state. Single input: `tenant_name`. If `active: true` → set `false`; if `active: false` → set `true`. When re-enabling, assign default schedule `"0 0 * * *"` if no schedule field exists (same as onboarding).

**Rejected:** Separate enable/disable workflow inputs — extra operator cognitive load.

### Q5: Remove from registry on offboard vs active: false?

**Decision:** Offboard **removes the registry entry entirely**. An offboarded tenant should not appear in dashboard or be a restore target. Branch remains as archival snapshot; restore from branch HEAD still works as a source ref.

### Q6: GitHub Environment on offboard?

**Decision (default for v1):** **Preserve** environment and secrets. Easier re-onboarding; stale credentials remain until manually cleaned. Document as trade-off.

**Open:** Could add optional env deletion in a future iteration (requires `ADMIN_TOKEN`).

### Q7: Update `.tenant.yaml` on branch?

**Decision:** Offboard sets `active: false` in `.tenant.yaml` on the tenant branch for consistency. Schedule toggle updates registry only in v1 (branch descriptor may drift briefly — acceptable).

### Q8: GitHub UI vs CLI?

**Decision:** Follow project principle — **GitHub Actions workflow_dispatch first**, CLI mirrors via `scripts/cli.mjs`. Both actions run on `main` only (registry lives on `main`).

### Q9: Relationship to existing `--remove`?

**Decision:** Deprecate or repurpose `onboard --remove` as CLI mirror of offboard (with tag deletion and branch squash), not registry-only local edit.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Force-push required for branch squash | Needed for single-commit outcome; branch protection may block — workflow needs appropriate permissions |
| Tag deletion is irreversible | Intended — point-in-time restore via old tags goes away; branch HEAD remains |
| Offboarded tenant cannot re-onboard without handling duplicate branch | Onboarding duplicate check must document re-onboard path (re-add to registry, skip branch creation) — future work or explicit failure message |
| Manual backup of paused tenant still possible via workflow_dispatch with tenant input | Acceptable — schedule toggle is about daily matrix, not blocking all backups |

## Capability Fit (existing openspec/specs/)

- Extend **tenant-lifecycle** / new **tenant-offboarding** for decommission flow
- Extend **tenant-registry** / new **tenant-schedule-toggle** for active flip
- Extend **cli-alignment** and **platform-integration** for workflow + CLI parity

## Validated Scope for Proposal

**In scope:**
- `schedule-toggle.yml` workflow + `scripts/schedule-toggle.mjs` (or shared tenant-mgmt script)
- `offboard.yml` workflow + `scripts/offboard.mjs`
- CLI routes in `cli.mjs`
- Tests: `test-schedule-toggle.mjs`, `test-offboard.mjs`
- README workflow documentation
- Delta specs with Gherkin scenarios

**Out of scope (v1):**
- GitHub Releases publishing
- GitHub Environment deletion on offboard
- Re-onboard/resume flow for offboarded tenants
- Cron schedule editing (only active toggle, not schedule expression changes)

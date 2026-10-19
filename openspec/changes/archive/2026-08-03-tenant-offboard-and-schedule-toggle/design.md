# Design: Tenant Offboard and Schedule Toggle

## Context

ISC Config Hub uses a branch-per-tenant model with `tenants.yaml` on `main` as the scheduling index. Onboarding is automated via GitHub Actions; decommission and pause/resume are not. Backup runs create commits on tenant branches and git tags `<tenant>/<timestamp>`. The scheduled backup matrix filters `active: true` tenants via `scripts/parse-tenants.mjs`.

Operators need:
1. A **reversible toggle** to include/exclude a tenant from daily backups without touching history.
2. An **offboard** action to decommission: stop scheduling, delete tag clutter, collapse branch to one snapshot commit.

Both must be available from GitHub Actions (primary UX) with CLI parity.

## Goals / Non-Goals

**Goals:**
- Schedule Toggle workflow + CLI: flip `active` in `tenants.yaml` on `main`
- Offboard workflow + CLI: registry removal, tag deletion, branch squash to single commit, branch preserved
- Mirror onboarding patterns (main-only guard, pull/rebase before registry push)
- Automated tests for each spec scenario

**Non-Goals (v1):**
- GitHub Releases creation or deletion
- GitHub Environment / secret deletion on offboard
- Re-onboard flow for offboarded tenants (document limitation)
- Editing cron `schedule` expressions (only `active` toggle)
- Deleting tenant git branches

## Decisions

### D1: Two actions instead of one "unregister"

- **Choice:** Separate Schedule Toggle and Offboard workflows
- **Reason:** Different blast radius — toggle is reversible and preserves tags/history; offboard is decommission with cleanup
- **Considered alternatives:** Single action with mode input — rejected as higher operator error risk

### D2: Schedule Toggle flips `active` based on current state

- **Choice:** Read `active`, write opposite value; single `tenant_name` input
- **Reason:** Simplest operator UX; double-toggle restores original state
- **Considered alternatives:** Explicit enable/disable inputs — rejected per user preference

### D3: Offboard removes registry entry (not just `active: false`)

- **Choice:** Delete tenant block from `tenants.yaml`
- **Reason:** Offboarded tenant should not appear in dashboard or be a restore target
- **Considered alternatives:** Set `active: false` only — rejected; insufficient cleanup signal

### D4: Branch squash via orphan commit + force-push

- **Choice:** Checkout tenant branch → read tree at HEAD → orphan branch → single commit → force-push
- **Reason:** Produces exactly one commit with latest backup files; old commits become unreachable
- **Considered alternatives:** `git rebase` squash — messier with many merges; tag pointers complicate history

### D5: Tag deletion via remote ref deletion

- **Choice:** List tags matching `<tenant>/*`, push `:refs/tags/<tag>` for each
- **Reason:** Matches existing tag naming convention; clears GitHub Tags tab entries for tenant
- **Considered alternatives:** Leave tags — rejected; user wants tag cleanup on offboard

### D6: Preserve GitHub Environment on offboard

- **Choice:** Do not delete environment or secrets in v1
- **Reason:** Simpler implementation; enables manual re-onboard without recreating secrets
- **Considered alternatives:** Delete environment via GitHub API — deferred; requires `ADMIN_TOKEN` and irreversible credential loss

### D7: Shared registry update module

- **Choice:** Extract or reuse `tenant-registry.mjs` / `onboard.mjs` save logic for atomic `tenants.yaml` read-modify-write with pull/rebase in workflows
- **Reason:** Same concurrency pattern as onboarding when multiple operators act on registry
- **Considered alternatives:** Inline YAML in workflows — rejected; duplicates parser logic

### D8: CLI routing

- **Choice:** `node scripts/cli.mjs schedule-toggle <tenant>` and `node scripts/cli.mjs offboard <tenant>`
- **Reason:** Aligns with existing cli-alignment pattern
- **Considered alternatives:** Extend `onboard` subcommands — offboard replaces `--remove`; schedule-toggle is new top-level command

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │              main branch             │
                    │  tenants.yaml (scheduling index)     │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
  schedule-toggle.yml        offboard.yml           scheduled-backup.yml
          │                        │                        │
          ▼                        ▼                        │
  schedule-toggle.mjs        offboard.mjs                   │
  (flip active)         (remove entry + tags + squash)       │
          │                        │                        │
          └─────────────── tenants.yaml ────────────────────┘
                                   │
                                   ▼
                          tenant branch (preserved)
                          backups/<tenant>/ @ HEAD
```

## Risks / Trade-offs

- **[Risk] Force-push blocked by branch protection** → Mitigation: document required ruleset exception for bot/service account; workflow fails with clear message
- **[Risk] Large tag count slows offboard** → Mitigation: batch tag deletion; log progress; acceptable for typical daily-backup volume
- **[Risk] Re-onboard after offboard fails duplicate branch check** → Mitigation: document manual re-registry path; defer automated resume to future change
- **[Risk] Schedule toggle does not update `.tenant.yaml` on branch** → Mitigation: accept brief drift in v1; offboard updates branch descriptor
- **[Trade-off] Stale GitHub Environment after offboard** → Accepted for v1 simplicity

## Migration Plan

1. Deploy workflows and scripts to `main`
2. Document Schedule Toggle and Offboard in README (replace manual `active: false` guidance)
3. Mark `onboard --remove` as deprecated in help text pointing to `offboard`
4. No migration of existing tenants required — actions are operator-initiated
5. **Rollback:** Re-add tenant to `tenants.yaml` manually; tags deleted by offboard cannot be restored unless reflog/recovery from GitHub support

## Open Questions

- Should offboard require typing tenant name as confirmation in the workflow (recommended: yes)?
- Should sync-workflows continue to skip offboarded tenants automatically (yes — they are removed from registry)?

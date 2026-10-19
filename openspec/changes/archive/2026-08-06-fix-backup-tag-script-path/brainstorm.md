# Brainstorm: Fix Backup Tag Script Path After Tenant Branch Checkout

Raw capture from design exploration (2026-08-06).

## Background

Backup workflows check out `main` for scripts, run the backup, then switch to the tenant branch to commit `backups/`. After `git checkout -B <tenant> origin/<tenant>`, the working tree no longer contains `scripts/` (tenant branches carry only backup data and branch metadata).

Since commit `4c97164`, workflows invoke `bash scripts/create-backup-tag.sh` (or on remote `main`, `push-backup-tag.sh`) **after** the tenant branch checkout. GitHub Actions logs show `bash: scripts/push-backup-tag.sh: No such file or directory` (exit 127). Branch commits often succeed; tag creation always fails; workflow is marked failed.

The manual backup release step already avoids this with `git show main:scripts/create-backup-release.sh`.

## Decision Chain

### Q1: Where should tag scripts live during the tag step?

**Decision:** Restore tag helper scripts from `main` immediately before invoking them, while remaining checked out on the tenant branch (so `HEAD:backups` resolves correctly for `create-backup-tag.sh`).

**Options considered:**
- **A. `git checkout main -- scripts/...`** — simple, keeps relative paths in helper
- **B. `git show main:scripts/... > $TMP && bash`** — matches release step pattern; no working-tree mutation
- **C. Run tag helper before tenant checkout** — breaks `create-backup-tag.sh` which reads `HEAD:backups` on tenant branch

**Choice:** **A or B** — prefer **B** (temp file from `git show`) to avoid overwriting tenant-branch state; align with existing release step.

### Q2: Which workflows?

**Decision:** Both `backup.yml` and `scheduled-backup.yml` commit/tag steps.

### Q3: Which scripts to restore?

**Decision:** `create-backup-tag.sh`, `push-backup-tag.sh`, and `push-with-retry.sh` (transitive dependency).

### Q4: Fail behavior if script missing on main?

**Decision:** Fail the step with clear error — indicates deployment bug, not transient.

## Design Trade-offs

| Trade-off | Acceptance |
|-----------|------------|
| Extra `git show` per tag | Negligible vs backup runtime |
| Duplicated restore snippet in two workflows | Extract shared inline pattern or small wrapper in follow-up |
| Local uncommitted fix still broken | This change deploys the correct pattern to `main` |

## Validated Scope

**In scope:** Restore scripts from `main` before tag helper in both backup workflows; tests in `test-workflow-references.mjs`; workflow reference docs.

**Out of scope:** Changing tenant branch layout; tag semantics (covered by make-releases-backups-only); axa API failures; retry concurrency.

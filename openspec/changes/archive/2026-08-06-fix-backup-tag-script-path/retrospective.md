# Retrospective: fix-backup-tag-script-path

> Written: 2026-08-06 (after verify passed)
> Commit range: `uncommitted (apply session)`
> Worktree: `/Users/fernando.delosrios/Documents/Development/ISC/resources/isc-config-backup`

---

## 0. Evidence

- **Commit range**: uncommitted at write-time (apply session)
- **Diff size**: ~6 files (workflows, test, README, CHANGELOG, tasks)
- **Tasks done**: 9/9
- **Active hours**: ~1h apply session
- **Subagent dispatches**: n/a (direct implementation)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none
- **OpenSpec validate state at archive**: pass
- **Test coverage signal**: `node scripts/test-workflow-references.mjs` — 40 assertions PASS

Commit chain (chronological):

```
(pending archive commit)
```

---

## 1. Wins

- [evidence: `.github/workflows/backup.yml`, `scheduled-backup.yml`] Reused proven `git show main:scripts/...` pattern from release step for tag helpers
- [evidence: `scripts/test-workflow-references.mjs`] Regression guard prevents direct `bash scripts/create-backup-tag.sh` on tenant branches
- [evidence: `CHANGELOG.md`] Documents operator impact since 2026-08-05 failed scheduled runs

## 2. Misses

- 📌 [nit | evidence: test assertion] Initial test expected literal per-script `git show` lines; loop-based restore required test adjustment

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| 1.1–1.3 | Added `set -euo pipefail` inside helper | Spec scenario: tag step fails when main scripts missing |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (prior artifact) |
| superpowers:writing-plans                        | ✓ (prior artifact) |
| superpowers:using-git-worktrees                  | ✗ |
| superpowers:subagent-driven-development          | ✗ |
| (transitive) superpowers:test-driven-development | partial (test extended after implementation) |
| (transitive) superpowers:requesting-code-review  | ✗ |
| superpowers:finishing-a-development-branch       | pending (post-archive) |

### Deliberately Skipped Skills

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: Per-task subagent dispatch loop
  - **Why this cycle**: Single focused bugfix with 9 tasks across 6 files; direct apply matched plan scope
  - **How to prevent recurrence**: `scope-judgment rule` — use subagents when task count >15 or cross-module refactors

## 5. Surprises

- Tenant branch checkout silently removed `scripts/` access; release step already solved this but tag step did not inherit the pattern

## 6. Promote candidates -> long-term learning

- [ ] 🟡 **Mirror release-step script restore for any new tenant-branch workflow steps** -> **Promote to project CLAUDE.md**
  > **Why**: Second occurrence of "scripts missing after tenant checkout" class of bug
  > **How to apply**: When adding workflow steps after `git checkout` to tenant branch, default to `git show main:scripts/...` bootstrap

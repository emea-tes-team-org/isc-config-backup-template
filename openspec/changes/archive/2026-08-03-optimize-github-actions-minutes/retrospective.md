# Retrospective: optimize-github-actions-minutes

> Written: 2026-08-03 (after verify passed; post-archive artifact backfill)
> Commit range: uncommitted working tree (not yet on a feature branch)
> Worktree: `/Users/fernando.delosrios/Documents/Development/ISC/resources/isc-config-backup`

---

## 0. Evidence

- **Commit range**: n/a — implementation completed in-session; ~20 files modified, uncommitted at retro time
- **Diff size**: +779 / −250 lines across 20 files (workflows, parser, tests, docs, openspec)
- **Tasks done**: 24/24 (`tasks.md`)
- **Active hours**: ~1 session (apply + verify fixes + archive)
- **Subagent dispatches**: 0 (single-agent apply)
- **New external dependencies**: none
- **Bugs encountered post-merge**: none (not yet merged)
- **OpenSpec validate state at archive**: pass (30/30 specs valid)
- **Test coverage signal**: 5 test scripts pass (`test-parse-tenants`, `test-workflow-references`, `test-cron-utils`, `test-generate-report`, `test-generate-dashboard`); parse-tenants grew from 3 to 11 assertions

Commit chain (chronological):

```
(uncommitted) GitHub Actions minutes optimization — parser, workflows, tests, docs, openspec archive
```

---

## 1. Wins

- [evidence: scripts/parse-tenants.mjs] Tag pending detection uses name-embedded timestamps — stops false retries for squashed-tag tenants (mediolanum excluded from pending when today's tags exist)
- [evidence: scheduled-backup.yml] Cron reduced from 96 to 8 triggers/day for midnight fleet; schedule gate re-enabled on cron events
- [evidence: test-workflow-references.mjs] Workflow regression suite now guards optimization invariants (cron, concurrency, cache, dashboard inline)
- [evidence: openspec archive] Delta specs synced to main (6 added, 5 modified) after fixing archive blockers interactively
- [evidence: verify.md warning fix] Summary job runs on backup failure via `always() && count != '0'`

## 2. Misses

- 🟡 [painful | evidence: archive attempt 1–3] Archive required three delta-spec fixes (invalid REMOVED header, renamed scenario, MODIFIED header mismatch) — cost extra cycle before archive succeeded
- 🟡 [painful | evidence: generate-dashboard.mjs:167] Dashboard tag listing still sorts by creatordate; out of scope but inconsistent with parser fix
- 📌 [nit | evidence: design.md acceptance] 24h production minute reduction not yet measured — deferred to post-merge operator monitoring
- 📌 [nit | evidence: git status] verify.md and retrospective.md written after archive; artifacts backfilled into archive folder

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Summary job if | Added `always()` alongside count check | Verify found regression: summary skipped when backup jobs fail |
| isBackupPending | Added `getCurrentWindowScheduledTime` / before-window | Spec scenario + verify gap; tenants not pending before schedule opens |
| Archive delta specs | Fixed headers/scenarios mid-archive | openspec archive CLI rejected invalid MODIFIED/REMOVED blocks |
| subagent-driven-development | Not used | Single-agent session executed plan directly |

## 4. Skill / workflow compliance

| Skill                                            | Used |
|--------------------------------------------------|------|
| superpowers:brainstorming                        | ✓ (brainstorm.md artifact) |
| superpowers:writing-plans                        | ✓ (plan.md artifact) |
| superpowers:using-git-worktrees                  | ✗ |
| superpowers:subagent-driven-development          | ✗ |
| (transitive) superpowers:test-driven-development | ✓ (parser tests before/with implementation) |
| (transitive) superpowers:requesting-code-review  | ✗ |
| superpowers:finishing-a-development-branch       | ✗ (not yet at PR stage) |

### Deliberately Skipped Skills

- **`superpowers:subagent-driven-development`**
  - **What was skipped**: Per-task subagent dispatch and formal code review loop
  - **Why this cycle**: Single cohesive change across 5 plan groups in one session; agent executed plan.md micro-tasks sequentially without Task tool invocations
  - **How to prevent recurrence**: `scope-judgment rule` — use SDD when plan has 7+ independent file domains or when apply spans multiple sessions; monolithic CI/parser changes in one session may stay single-agent

- **`superpowers:using-git-worktrees`**
  - **What was skipped**: Isolated worktree for feature branch
  - **Why this cycle**: Work landed on existing workspace branch with other untracked agent skills present; no worktree isolation requested
  - **How to prevent recurrence**: `CLAUDE.md trigger` — invoke worktree skill at start of `/opsx:apply` when workspace has dirty unrelated files

- **`superpowers:finishing-a-development-branch`**
  - **What was skipped**: PR creation and merge decision
  - **Why this cycle**: User has not requested commit/PR; archive completed before integration step
  - **How to prevent recurrence**: Normal — runs after user requests PR

## 5. Surprises

- OpenSpec archive rejects REMOVED requirements that don't exist in main specs — dashboard auto-trigger was never documented in main `dashboard-generation` spec
- Renaming a scenario title in delta specs triggers "dropping scenarios" error even when content is preserved — must keep original scenario names for MODIFIED blocks
- Importing `parse-tenants.mjs` in tests ran CLI side effects until `import.meta.url` guard was added

## 6. Promote candidates -> long-term learning

- [ ] 🟡 **Delta spec MODIFIED headers must match main spec exactly** -> **Promote to memory** (type: feedback)
  > **Why**: Three failed archive attempts before successful sync
  > **How to apply**: When writing delta specs, copy requirement headers verbatim from `openspec/specs/<capability>/spec.md`; use MODIFIED to replace content, not REMOVED+new name

- [ ] 🟡 **Align generate-dashboard tag sort with parse-tenants** -> **Promote to project backlog** (follow-up change)
  > **Why**: Dashboard still uses creatordate; parser uses name timestamp after this change
  > **How to apply**: Small follow-up change reusing `buildLatestTagMapFromTags`

- [ ] 📌 **Post-merge GHA minute monitoring** -> **One-off** (operator checklist)
  > **Why**: Acceptance criteria require 24h production evidence
  > **How to apply**: `gh run list --workflow="Scheduled ISC Backup Matrix" --limit 20` after merge

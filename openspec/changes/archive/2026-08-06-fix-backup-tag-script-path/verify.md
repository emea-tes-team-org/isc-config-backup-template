# Verification Report

> Generated inside apply step 2 (verify-fix loop). Apply must not report done until Overall Decision is ✅ PASS — fix blocking items autonomously; do not hand verify failures to the user. Standalone `/opsx:verify` is for re-runs after interruption.

**Change**: `fix-backup-tag-script-path`
**Verified at**: `2026-08-06 10:57`
**Verifier**: `cursor-agent (opsx-apply)`

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] All items have `"valid": true`

**Result**:

```text
openspec validate --all --json — exit 0, no items with "valid": false
```

If there are failed items, list their id + issues:

| Item | Type | Issues |
|---|---|---|
| — | — | — |

---

## 2. Task Completion Sanity Check (`tasks.md`)

- [x] All `- [ ]` are `- [x]` (including Documentation and Changelog sections)

**Uncompleted tasks** (any row here = FAIL, return to apply):

| Task | Reason |
|---|---|
| — | — |

---

## 3. Spec Scenario Test Coverage

For each `#### Scenario:` in this change's delta specs, map to an automated test that exercises the assertions:

| Scenario (spec / requirement) | Test (file / name) | Covers GIVEN/WHEN/THEN? |
|---|---|---|
| Manual backup creates tag after tenant branch checkout | `scripts/test-workflow-references.mjs` — backup.yml restores tag scripts from main | ✓ |
| Tag step fails clearly when main scripts missing | `run_create_backup_tag` uses `set -euo pipefail`; `git show` failure exits step | ✓ (workflow behavior) |
| Matrix backup restores tag scripts from main | `scripts/test-workflow-references.mjs` — scheduled-backup.yml restores tag scripts | ✓ |
| Modified backup/scheduled-backup scenarios (unchanged semantics) | Existing tag/release assertions in `test-workflow-references.mjs` | ✓ |

**Coverage gaps** (any ✗ missing = FAIL, return to apply to add tests):

- none

---

## 4. Design / Specs Coherence

Spot-check that design.md decisions are reflected in specs/ requirements:

| Design decision | Corresponding requirement / scenario | Gap? |
|---|---|---|
| D1: Inline `git show main:scripts/<file>` to temp path | Tag helper scripts restored from main | none |
| D2: Restore trio with sibling layout | Preserve sibling layout in workflow helper | none |
| D3: Duplicate inline block in both workflows | Applied to backup.yml and scheduled-backup.yml | none |

**Material drift** (decision with no spec counterpart = FAIL):

- none

---

## 5. Deferred Manual Dogfood vs Automated Test Equivalence

| Deferred dogfood (plan §) | Equivalent automated test | Coverage assessment | True gap? |
|---|---|---|---|
| — | — | plan.md has no `[~]` rows | — |

---

## Overall Decision

- [x] ✅ PASS — Can proceed to retrospective and archive
- [ ] ❌ FAIL — Return to apply; fix issues and re-run verify

**Next Step**:

Archive change and sync delta specs to `openspec/specs/`.

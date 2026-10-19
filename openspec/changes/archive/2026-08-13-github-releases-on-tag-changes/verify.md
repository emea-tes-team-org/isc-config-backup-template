# Verification Report

> Generated inside apply step 2 (verify-fix loop). Apply must not report done until Overall Decision is ✅ PASS — fix blocking items autonomously; do not hand verify failures to the user. Standalone `/opsx:verify` is for re-runs after interruption.

**Change**: `github-releases-on-tag-changes`
**Verified at**: `2026-08-13 12:31`
**Verifier**: Cursor agent

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] All items have `"valid": true`

**Result**:

```text
33/33 items passed (2 changes, 31 specs). github-releases-on-tag-changes: valid.
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
| backup / Manual backup with changes creates release | `scripts/test-create-backup-release.mjs` — changed tree reports release creation; zip contains flat backups/ paths | ✓ |
| backup / Unchanged backup pushes tag but skips release | `scripts/test-create-backup-release.mjs` — unchanged tree emits skip message; does not call gh release create | ✓ |
| backup / First restore-point tag creates release | `scripts/test-create-backup-release.mjs` — first tag creates release | ✓ |
| backup / Release failure is non-fatal | `scripts/test-create-backup-release.mjs` — gh release failure exits 0 (non-fatal) | ✓ |
| scheduled-backup / Scheduled backup with changes creates release | `scripts/test-create-backup-release.mjs` — changed tree (shared helper used by scheduled-backup.yml) | ✓ |
| scheduled-backup / Scheduled unchanged backup pushes tag but skips release | `scripts/test-create-backup-release.mjs` — unchanged tree skip; `scripts/test-workflow-references.mjs` — scheduled-backup publishes via helper | ✓ |
| scheduled-backup / Scheduled release failure is non-fatal | `scripts/test-create-backup-release.mjs` — gh release failure exits 0 (shared helper) | ✓ |

**Coverage gaps** (any ✗ missing = FAIL, return to apply to add tests):

- none

---

## 4. Design / Specs Coherence

Spot-check that design.md decisions are reflected in specs/ requirements:

| Design decision | Corresponding requirement / scenario | Gap? |
|---|---|---|
| D1: Keep tags on unchanged; gate releases only | Unchanged backup pushes tag but skips release (both specs) | none |
| D2: Compare `backups/` tree SHA at tag refs | Changed vs unchanged release tests in helper | none |
| D3: Previous-tag lookup in bash by timestamp | Exercised by unchanged/changed git fixture tests | none |
| D4: Skip is success (info log, exit 0) | unchanged tree emits skip message; no warning annotation | none |
| D5: Workflows unchanged; logic in helper | `scripts/test-workflow-references.mjs` — both workflows invoke create-backup-release.sh | none |

**Material drift** (decision with no spec counterpart = FAIL):

- none

---

## 5. Deferred Manual Dogfood vs Automated Test Equivalence

| Deferred dogfood (plan §) | Equivalent automated test | Coverage assessment | True gap? |
|---|---|---|---|
| — | — | — | — |

> Plan.md has no `[~]` deferred rows — section N/A (PASS).

---

## Overall Decision

- [x] ✅ PASS — Can proceed to retrospective and archive
- [ ] ❌ FAIL — Return to apply; fix issues and re-run verify

**Next Step**:

Proceed to retrospective, then archive the change.

# Verification Report

**Change**: `tenant-offboard-and-schedule-toggle`
**Verified at**: 2026-08-03 17:38 UTC+2
**Verifier**: opsx-verify (agent, re-run after fixes)

---

## 1. Structural Validation (`openspec validate --all --json`)

- [x] All items have `"valid": true`
- [x] Change validates: `openspec validate tenant-offboard-and-schedule-toggle --type change --strict`

**Result**: PASS

---

## 2. Task Completion Sanity Check (`tasks.md`)

- [x] All 24/24 tasks marked `- [x]`

**Uncompleted tasks**: none

---

## 3. Spec Scenario Test Coverage

| Scenario (spec / requirement) | Test (file / name) | Covers GIVEN/WHEN/THEN? |
|---|---|---|
| Toggle removes active tenant from schedule | `test-schedule-toggle.mjs` toggle off + matrix exclusion | ✓ |
| Toggle adds inactive tenant to schedule | `test-schedule-toggle.mjs` toggle on + matrix inclusion | ✓ |
| Toggle assigns default schedule when re-enabling | `test-schedule-toggle.mjs` re-enable without schedule | ✓ |
| Toggle rejects unknown tenant | `test-schedule-toggle.mjs` unknown tenant | ✓ |
| Schedule toggle runs on main only | `test-workflow-references.mjs` main guard | ✓ |
| Tags remain after toggle off | `test-schedule-toggle.mjs` pure registry assertion | ✓ |
| Branch history remains after toggle off | `test-schedule-toggle.mjs` pure registry assertion | ✓ |
| CLI toggles active flag locally | `test-schedule-toggle.mjs` save/reload round-trip | ✓ |
| Successful offboard removes registry | `test-offboard.mjs` offboardRegistry + parse-tenants | ✓ |
| Offboard deletes all tenant backup tags | `test-offboard.mjs` deleteMatchingTags mock | ✓ |
| Offboard squashes branch to single commit | `test-offboard.mjs` squash git mock | ✓ |
| Offboard preserves tenant branch | `test-offboard.mjs` branch -M same name | ✓ |
| Offboard sets active false in branch descriptor | `test-offboard.mjs` setTenantYamlInactive | ✓ |
| Offboard rejects unknown tenant | `test-offboard.mjs` offboardTenant unknown | ✓ |
| Offboard rejects confirmation mismatch | `test-offboard.mjs` checkConfirmation + workflow | ✓ |
| Offboard runs on main only | `test-workflow-references.mjs` main guard | ✓ |
| Environment remains after offboard | no deletion code in `offboard.mjs` | ✓ |
| CLI offboard removes registry entry | `test-offboard.mjs` offboardRegistry | ✓ |
| CLI routes schedule-toggle / offboard | `test-workflow-references.mjs` + cli help | ✓ |
| Toggled-off/on tenant matrix exclusion | `test-schedule-toggle.mjs` parse-tenants integration | ✓ |
| Offboarded tenant absent from parser | `test-offboard.mjs` parse-tenants --all | ✓ |
| Offboarded tenant cannot be restore target | `test-offboard.mjs` isRegisteredTenant | ✓ |
| Workflow reports schedule enable/disable | `schedule-toggle.yml` summary + GITHUB_OUTPUT | ✓ |

**Coverage gaps**: none

---

## 4. Design / Specs Coherence

| Design decision | Corresponding requirement / scenario | Gap? |
|---|---|---|
| D1–D8 | All reflected in implementation | None |

**Material drift**: None

---

## 5. Deferred Manual Dogfood vs Automated Test Equivalence

No `[~]` deferred rows in plan.md — section N/A (PASS).

---

## Fixes Applied (2026-08-03)

- Extended `test-workflow-references.mjs` with main-branch guards and confirmation validation
- Added `parse-tenants.mjs` matrix integration tests to schedule-toggle and offboard tests
- Added `deleteMatchingTags`, `offboardTenant` unknown-tenant, branch-preserve, and restore-target tests
- Enhanced `schedule-toggle.yml` summary with enable/disable messaging via `GITHUB_OUTPUT`
- Refactored `onboard.mjs` to use shared `saveRegistry` from `tenant-registry.mjs`
- Added `isRegisteredTenant` helper for restore-target validation parity

---

## Overall Decision

- [x] ✅ PASS — Can proceed to retrospective and archive
- [ ] ❌ FAIL — Return to apply; fix issues and re-run verify

**Next Step**: Archive with `/opsx:archive`, commit on a feature branch, open PR.

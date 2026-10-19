# ISC Onboarding Update In Place Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make ISC Onboarding workflow idempotent — create or update tenant branch, environment secrets, and registry entry in place, matching CLI behavior.

**Architecture:** Extend `onboard.mjs` for workflow token auth and branch-exists handling; replace duplicate-check + bash provisioning steps in `onboarding.yml` with a single Node invocation after credential validation. Registry merge reuses `updateTenantRegistry()`.

**Tech Stack:** Node.js 20 ESM, GitHub Actions workflow_dispatch, `gh` CLI / GitHub REST API, js-yaml

**Canonical test command:** `node scripts/test-onboard-upsert.mjs` and `node scripts/test-workflow-references.mjs`

---

## Task 1: Onboard script — workflow token auth (TDD)

- [x] **Step 1:** Create `scripts/test-onboard-upsert.mjs` with failing tests: `getPat()` prefers `GH_TOKEN` when set; registry merge preserves `schedule` and `environment`
- [x] **Step 2:** Run tests — expect failures
- [x] **Step 3:** Update `getPat()` / `githubApi()` in `onboard.mjs` to use `process.env.GH_TOKEN || process.env.ADMIN_TOKEN` before `.local-pat`
- [x] **Step 4:** Run tests — token tests pass
- [x] **Commit:** `feat(onboard): prefer GH_TOKEN for workflow auth`

## Task 2: Onboard script — branch exists path (TDD)

- [x] **Step 1:** Add failing tests for `branchExists(owner, repo, name)` helper and metadata-only update path
- [x] **Step 2:** Implement branch detection via GitHub API refs
- [x] **Step 3:** When branch exists: skip `createBranch`; update `.tenant.yaml` / `.gitignore` via Contents API
- [x] **Step 4:** Export upsert outcome via `onboard_action` output and `computeOnboardOutcome`
- [x] **Step 5:** Run `node scripts/test-onboard-upsert.mjs` — expect pass
- [x] **Commit:** `feat(onboard): upsert existing tenant branch and registry`

## Task 3: Refactor onboarding.yml

- [x] **Step 1:** Remove "Check for duplicate tenant" step
- [x] **Step 2:** After credential validation, invoke `onboard.mjs --from-env --push-registry`
- [x] **Step 3:** Add summary step reading create/update outcome from `onboard_action`
- [x] **Step 4:** Run `node scripts/test-workflow-references.mjs`
- [x] **Commit:** `feat(onboarding): idempotent upsert via shared onboard script`

## Task 4: Documentation and validation

- [x] **Step 1:** Update README — re-onboard and secret refresh via ISC Onboarding workflow
- [x] **Step 2:** Add CHANGELOG Unreleased entry
- [x] **Step 3:** Run `openspec validate isc-onboarding-update-in-place --strict`
- [x] **Commit:** `docs: idempotent onboarding workflow`

---

## Verification Checklist

```bash
node scripts/test-onboard-upsert.mjs
node scripts/test-workflow-references.mjs
openspec validate isc-onboarding-update-in-place --strict
```

All tests must pass before marking change complete.

## Manual dogfood (deferred)

- [~] **Dogfood:** Re-onboard `mediolanum` via workflow_dispatch with valid credentials — confirm secrets set and registry entry restored

> Deferred to post-merge operator verification; automated tests cover workflow structure and registry merge logic.

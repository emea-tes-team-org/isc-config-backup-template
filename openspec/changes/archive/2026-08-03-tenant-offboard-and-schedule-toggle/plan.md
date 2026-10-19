# Tenant Offboard and Schedule Toggle Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add GitHub Actions and CLI actions for schedule toggle (flip `active`) and tenant offboard (registry removal, tag deletion, branch squash).

**Architecture:** Two new scripts (`schedule-toggle.mjs`, `offboard.mjs`) routed through `cli.mjs`, invoked by two new workflows on `main`. Registry updates reuse `tenant-registry.mjs` patterns from onboarding. Offboard uses orphan commit + force-push for single-commit branch.

**Tech Stack:** Node.js 20 ESM, js-yaml, git CLI, GitHub Actions workflow_dispatch

**Canonical test command:** `node scripts/test-schedule-toggle.mjs` and `node scripts/test-offboard.mjs`

---

## Task 1: Schedule Toggle Script (TDD)

- [x] **Step 1:** Create `scripts/test-schedule-toggle.mjs` with failing tests: flip true→false, false→true, default schedule on re-enable, unknown tenant exits 1
- [x] **Step 2:** Run `node scripts/test-schedule-toggle.mjs` — expect failures
- [x] **Step 3:** Create `scripts/schedule-toggle.mjs` with exported `toggleTenantActive(registry, tenantName)` function
- [x] **Step 4:** Implement flip logic and default schedule assignment matching `onboard.mjs` lines 431-434
- [x] **Step 5:** Wire CLI arg parsing: `node scripts/schedule-toggle.mjs <tenant> [--push]`
- [x] **Step 6:** Run `node scripts/test-schedule-toggle.mjs` — expect pass
- [x] **Commit:** `feat: add schedule-toggle script with tests`

## Task 2: Offboard Script — Registry (TDD)

- [x] **Step 1:** Create `scripts/test-offboard.mjs` with failing test: `removeTenantFromRegistry(registry, name)` removes entry, preserves others
- [x] **Step 2:** Run `node scripts/test-offboard.mjs` — expect failure
- [x] **Step 3:** Implement registry removal in `scripts/offboard.mjs` using `loadRegistry` from `tenant-registry.mjs`
- [x] **Step 4:** Run tests — registry tests pass
- [x] **Commit:** `feat: offboard registry removal with tests`

## Task 3: Offboard Script — Tags and Squash (TDD)

- [x] **Step 1:** Add tests for `listTenantTags(tags, tenant)` filter and `squashBranch` tree preservation (mock git or temp repo)
- [x] **Step 2:** Implement tag listing filter: tags starting with `<tenant>/`
- [x] **Step 3:** Implement squash: `git checkout <tenant>`, `git checkout --orphan temp`, `git add -A`, commit, `git branch -M <tenant>`, `git push --force`
- [x] **Step 4:** Update `.tenant.yaml` on branch: set `active: false`
- [x] **Step 5:** Add confirmation check: CLI prompts; `--yes` or `CONFIRM_TENANT` env for CI
- [x] **Step 6:** Run `node scripts/test-offboard.mjs` — expect pass
- [x] **Commit:** `feat: offboard tag deletion and branch squash`

## Task 4: CLI Integration

- [x] **Step 1:** Add to `scripts/cli.mjs` COMMANDS: `schedule-toggle: "schedule-toggle.mjs"`, `offboard: "offboard.mjs"`
- [x] **Step 2:** Update `printHelp()` with examples
- [x] **Step 3:** Add deprecation note in `scripts/onboard.mjs` `--remove` help
- [x] **Step 4:** Run `node scripts/cli.mjs --help` — verify output
- [x] **Commit:** `feat: wire schedule-toggle and offboard into CLI`

## Task 5: GitHub Actions Workflows

- [x] **Step 1:** Create `.github/workflows/schedule-toggle.yml` mirroring `onboarding.yml` main guard pattern
- [x] **Step 2:** Workflow steps: checkout main, setup node, `node scripts/cli.mjs schedule-toggle ${{ inputs.tenant_name }} --push`
- [x] **Step 3:** Create `.github/workflows/offboard.yml` with `tenant_name` and `confirm_tenant_name` inputs; validate match in workflow step before CLI
- [x] **Step 4:** Offboard workflow: checkout with `fetch-depth: 0` for tag operations; configure git user; run offboard with `--yes`
- [x] **Step 5:** Update `scripts/test-workflow-references.mjs` to include both workflows
- [x] **Step 6:** Run `node scripts/test-workflow-references.mjs`
- [x] **Commit:** `feat: add schedule-toggle and offboard GitHub Actions workflows`

## Task 6: Documentation and Changelog

- [x] **Step 1:** Update README tenant management and new workflow sections
- [x] **Step 2:** Run changelog-generator or add CHANGELOG entry
- [x] **Step 3:** Run `openspec validate tenant-offboard-and-schedule-toggle --type change --strict`
- [x] **Commit:** `docs: document schedule toggle and offboard actions`

---

## Verification Checklist

```bash
node scripts/test-schedule-toggle.mjs
node scripts/test-offboard.mjs
node scripts/test-workflow-references.mjs
openspec validate tenant-offboard-and-schedule-toggle --type change --strict
```

All tests must pass before marking change complete.

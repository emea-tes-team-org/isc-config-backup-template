# Improve Backup Export Resilience Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Retry transient ISC export failures and support per-tenant poll/job timeout overrides.

**Architecture:** `backup.mjs` wraps export create+poll in retry loop. Registry fields flow through parse-tenants to matrix timeout and backup env vars.

**Tech Stack:** Node.js ES modules, GitHub Actions, js-yaml registry

**Canonical test command:** `node scripts/test-backup-export-retry.mjs` (new) + registry/parser tests

---

## Task 1: Registry fields

**Files:** `scripts/tenant-registry.mjs`, `scripts/parse-tenants.mjs`, `tenants.yaml`

- [ ] **Step 1:** Parse optional `exportPollMinutes`, `jobTimeoutMinutes` with defaults 10/15
- [ ] **Step 2:** Add to matrix JSON as `jobTimeoutMinutes`
- [ ] **Step 3:** Test parser output

## Task 2: Export retry in backup.mjs

**Files:** `scripts/backup.mjs`

- [ ] **Step 1:** Read `EXPORT_POLL_MINUTES` and `MAX_EXPORT_ATTEMPTS` from env (defaults 10, 3)
- [ ] **Step 2:** Outer loop: create export → poll until COMPLETE or retryable failure
- [ ] **Step 3:** On `FAILED_EXTERNAL_COMMUNICATION` after poll budget, retry if attempts remain
- [ ] **Step 4:** Log attempt numbers and job IDs

## Task 3: Workflow integration

**Files:** `.github/workflows/scheduled-backup.yml`, `.github/workflows/backup.yml`

- [ ] **Step 1:** `timeout-minutes: ${{ matrix.jobTimeoutMinutes || 15 }}`
- [ ] **Step 2:** Set `EXPORT_POLL_MINUTES: ${{ matrix.exportPollMinutes || 10 }}` on Run backup step
- [ ] **Step 3:** Add axa overrides after manual validation of values

## Task 4: Tests

- [ ] **Step 1:** Create `scripts/test-backup-export-retry.mjs` with mocked poll sequence
- [ ] **Step 2:** Run all tests — expect PASS

## Task 5: Docs and changelog

- [ ] **Step 1:** README per-tenant timeout section
- [ ] **Step 2:** CHANGELOG entry

**Note:** Can ship in parallel with tag fix; independent of retry change.

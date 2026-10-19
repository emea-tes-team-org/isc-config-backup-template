# Improve Scheduled Backup Retry Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Allow retry crons to complete in-progress runs and re-include tenants when branch commit exists but tag is missing.

**Architecture:** Disable cancel-in-progress on scheduled-backup concurrency. Extend `parse-tenants.mjs` to compute effective latest backup time from tags and branch commits.

**Tech Stack:** GitHub Actions YAML, Node.js (`parse-tenants.mjs`), git CLI in prepare-matrix

**Canonical test command:** `node scripts/test-parse-tenants.mjs` (extend or create) + `node scripts/test-workflow-references.mjs`

---

## Task 1: Concurrency policy

**Files:** `.github/workflows/scheduled-backup.yml`, `scripts/test-workflow-references.mjs`

- [ ] **Step 1:** Change `cancel-in-progress: true` → `false`
- [ ] **Step 2:** Update test assertion

## Task 2: Branch commit timestamp helper

**Files:** `scripts/parse-tenants.mjs`

- [ ] **Step 1:** Implement `getLatestBranchBackupCommitTime(tenant)` via `git log origin/<tenant> -1 --format=%cI --grep='^backup: '`
- [ ] **Step 2:** In `checkBackupPendingState`, when tag time < scheduledTime OR tag null, consider branch commit time
- [ ] **Step 3:** Tag time ≥ scheduledTime still wins (not pending)

## Task 3: Tests

**Files:** `scripts/test-parse-tenants.mjs` or extend existing pending tests

- [ ] **Step 1:** Fixture: commit today, no tag → pending
- [ ] **Step 2:** Fixture: tag today → not pending
- [ ] **Step 3:** Run tests — expect PASS

## Task 4: Docs and changelog

- [ ] **Step 1:** README scheduled backup retry section
- [ ] **Step 2:** CHANGELOG entry

**Prerequisite:** `fix-backup-tag-script-path` merged — otherwise retries still fail at tag step.

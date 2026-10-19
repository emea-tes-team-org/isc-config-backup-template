# Cleanup Ephemeral Backup Deployment Traces — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove GitHub Deployment records created as a side effect of backup jobs referencing tenant Environments, while preserving Environments and secrets.

**Architecture:** Shell helper (`cleanup-deployment.sh`) deletes the latest deployment for an environment via GitHub REST API; Node sweep script (`cleanup-deployments.mjs`) handles historical backlog. Backup workflows restore the shell helper from `main` after tenant-branch checkout (same pattern as tag/release helpers). Optional `cleanup-deployments.yml` workflow for manual sweeps with dry-run default.

**Tech Stack:** Bash + `gh` CLI, Node.js 20 ESM, GitHub Actions

**Canonical test command:** `node scripts/test-cleanup-deployment.mjs` and `node scripts/test-workflow-references.mjs`

---

## Task 1: Cleanup helper (TDD)

**Files:** `scripts/cleanup-deployment.sh`, `scripts/cleanup-deployments.mjs`, `scripts/test-cleanup-deployment.mjs`

- [x] **Step 1:** Add failing tests for shell script delete, no-op, DRY_RUN, non-fatal failure
- [x] **Step 2:** Implement `cleanup-deployment.sh` (list latest → inactive → delete)
- [x] **Step 3:** Add failing tests for `listDeployments`, sweep dry-run, sweep delete
- [x] **Step 4:** Implement `cleanup-deployments.mjs` with `--environment` and `--dry-run`
- [x] **Step 5:** Run `node scripts/test-cleanup-deployment.mjs` — all PASS

---

## Task 2: Backup workflow integration

**Files:** `.github/workflows/backup.yml`, `.github/workflows/scheduled-backup.yml`

- [x] **Step 1:** Add `deployments: write` to permissions in both workflows
- [x] **Step 2:** Add `Remove ephemeral deployment trace` step with `if: always()` restoring script from `main`
- [x] **Step 3:** Manual backup targets `TARGET_TENANT`; matrix job targets `matrix.environment`
- [x] **Step 4:** Extend `test-workflow-references.mjs` for permissions, cleanup step, and sweep workflow

---

## Task 3: Historical sweep workflow

**Files:** `.github/workflows/cleanup-deployments.yml`

- [x] **Step 1:** Create workflow_dispatch with `dry_run` default `true`
- [x] **Step 2:** Add main-branch guard and step summary via `cleanup-deployments.mjs`

---

## Task 4: Documentation

**Files:** `README.md`, `CHANGELOG.md`

- [x] **Step 1:** Document Environments vs deployment history under Scheduled Backups
- [x] **Step 2:** Add CHANGELOG Unreleased entry

---

## Verification checklist

- [x] `node scripts/test-cleanup-deployment.mjs` exits 0
- [x] `node scripts/test-workflow-references.mjs` exits 0
- [x] `openspec validate 2026-08-12-cleanup-backup-deployment-traces --strict` passes

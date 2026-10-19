# Fix Backup Tag Script Path Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Restore tag helper scripts from `main` before invoking `create-backup-tag.sh` on tenant branches.

**Architecture:** Inline bash in both workflows copies `scripts/{create-backup-tag,push-backup-tag,push-with-retry}.sh` from `main` into a temp directory mirroring repo layout, then executes the helper. Matches existing `create-backup-release.sh` pattern.

**Tech Stack:** GitHub Actions YAML, bash, `git show`, Node test scripts

**Canonical test command:** `node scripts/test-workflow-references.mjs`

---

## Task 1: Restore tag scripts in backup.yml

**Files:** `.github/workflows/backup.yml`

- [ ] **Step 1:** Add `restore_tag_scripts()` bash function or inline block before both `create-backup-tag.sh` invocations
- [ ] **Step 2:** Use `mktemp -d` + `git show main:scripts/<file> > "$TMP/scripts/<file>"` for all three scripts
- [ ] **Step 3:** Run `bash "$TMP/scripts/create-backup-tag.sh" "$TAG_NAME"`

## Task 2: Restore tag scripts in scheduled-backup.yml

**Files:** `.github/workflows/scheduled-backup.yml`

- [ ] **Step 1:** Apply identical restore block to unchanged and backed-up paths in Commit and push step
- [ ] **Step 2:** Verify YAML indentation and env var passthrough

## Task 3: Workflow reference tests

**Files:** `scripts/test-workflow-references.mjs`

- [ ] **Step 1:** Add assertions: `git show main:scripts/create-backup-tag.sh` or equivalent in both workflows
- [ ] **Step 2:** Run `node scripts/test-workflow-references.mjs` — expect PASS

## Task 4: Docs and changelog

- [ ] **Step 1:** README note under backup troubleshooting
- [ ] **Step 2:** CHANGELOG Unreleased entry

**Dependency:** Deploy to `main` before `improve-scheduled-backup-retry` (retry depends on tag step succeeding).

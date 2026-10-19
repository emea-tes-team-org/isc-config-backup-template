# Backups-Only Restore-Point Tags Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make backup restore-point tags reference commits containing only `./backups`, while tenant branch commits stay unchanged.

**Architecture:** A shared shell helper builds a backups-only commit with `git mktree` + `git commit-tree`, tags it, and pushes via the existing retry helper. Both `backup.yml` and `scheduled-backup.yml` call this helper instead of tagging branch HEAD.

**Tech Stack:** Bash, git plumbing, GitHub Actions, Node test scripts (`node scripts/test-*.mjs`)

**Canonical test command:** `node scripts/test-create-backup-tag.mjs` (new) and `node scripts/test-workflow-references.mjs`

---

## Task 1: Shared backup tag helper

**Files:**
- Create: `scripts/create-backup-tag.sh`
- Modify: (none yet)

**Requirements:** backup spec — "Tag commit contains only backups tree"; design D2, D3

### Step 1: Write failing test scaffold

Create `scripts/test-create-backup-tag.mjs` that:
1. Creates a temp git repo with branch commit containing `.tenant.yaml`, `.gitignore`, and `backups/acme-prod/ROLE/x.json`
2. Invokes `bash scripts/create-backup-tag.sh acme-prod/2026-08-05_12-00-00 HEAD` with `GIT_DIR` pointed at temp repo (or run in subprocess cwd)
3. Asserts tag tree has `backups/acme-prod/ROLE/x.json` and lacks `.tenant.yaml`

Run: `node scripts/test-create-backup-tag.mjs` — expect FAIL (script missing)

### Step 2: Implement minimal helper

```bash
#!/usr/bin/env bash
# create-backup-tag.sh — tag a backups-only commit and push
set -euo pipefail
TAG_NAME="${1:?usage: create-backup-tag.sh <tag-name> [source-ref]}"
SOURCE_REF="${2:-HEAD}"
BACKUPS_TREE=$(git rev-parse "${SOURCE_REF}:backups")
ROOT_TREE=$(printf '040000 tree %s\tbackups\n' "$BACKUPS_TREE" | git mktree)
TAG_COMMIT=$(git commit-tree "$ROOT_TREE" -m "backup: ${TAG_NAME##*/} snapshot (backups only)")
git tag -f "$TAG_NAME" "$TAG_COMMIT"
bash "$(dirname "$0")/push-backup-tag.sh" "$TAG_NAME"
```

Run test — expect PASS for tree assertions.

### Step 3: Commit

```bash
git add scripts/create-backup-tag.sh scripts/test-create-backup-tag.mjs
git commit -m "feat(backup): add create-backup-tag helper for backups-only tags"
```

---

## Task 2: Workflow integration

**Files:**
- Modify: `.github/workflows/backup.yml`, `.github/workflows/scheduled-backup.yml`, `scripts/test-workflow-references.mjs`

**Requirements:** backup + scheduled-backup delta specs; design D4

### Step 1: Extend workflow reference test (failing)

Add assertions:
```javascript
assert(
  backupWorkflow.includes("create-backup-tag.sh") &&
    scheduledBackup.includes("create-backup-tag.sh"),
  "backup workflows: tag creation uses backups-only helper"
);
assert(
  !backupWorkflow.match(/git tag "\$\{\{/) &&
    !scheduledBackup.match(/git tag "\$\{\{ matrix\.tenant \}\}/),
  "backup workflows: no direct git tag on branch HEAD"
);
```

Run: `node scripts/test-workflow-references.mjs` — expect FAIL

### Step 2: Update backup.yml

Replace:
```bash
git tag "$TAG_NAME"
# ...
bash scripts/push-backup-tag.sh "$TAG_NAME"
```
With:
```bash
bash scripts/create-backup-tag.sh "$TAG_NAME"
```

Remove duplicate `git tag -f` in push-conflict retry block — re-call helper after re-commit.

### Step 3: Update scheduled-backup.yml

Same replacement in both unchanged and backed-up branches.

### Step 4: Run tests

```bash
node scripts/test-workflow-references.mjs
node scripts/test-create-backup-tag.mjs
```

### Step 5: Commit

```bash
git add .github/workflows/backup.yml .github/workflows/scheduled-backup.yml scripts/test-workflow-references.mjs
git commit -m "feat(backup): tag backups-only commits in backup workflows"
```

---

## Task 3: Expanded test coverage

**Files:** `scripts/test-create-backup-tag.mjs`

**Requirements:** All delta spec scenarios

### Step 1: Add SHA inequality test

Assert `git rev-parse HEAD` ≠ `git rev-parse TAG_NAME` when `.tenant.yaml` exists on branch.

### Step 2: Add restore-path read test

Use `git show TAG:backups/acme-prod/ROLE/x.json` and assert content matches fixture.

### Step 3: Commit

```bash
git add scripts/test-create-backup-tag.mjs
git commit -m "test(backup): cover backups-only tag scenarios"
```

---

## Task 4: Documentation and changelog

**Files:** `README.md`, `CHANGELOG.md`

### Step 1: README section

Document that restore-point tags (`<tenant>/<timestamp>`) contain only `backups/`; tenant branches retain metadata files.

### Step 2: CHANGELOG Unreleased entry

User-facing note: tag downloads and browse tree show backup data only.

### Step 3: Commit

```bash
git add README.md CHANGELOG.md
git commit -m "docs(backup): document backups-only restore-point tags"
```

---

## Verification checklist

- [ ] `node scripts/test-create-backup-tag.mjs` passes
- [ ] `node scripts/test-workflow-references.mjs` passes
- [ ] Manual review: tag commit tree has single top-level `backups/` entry
- [ ] Manual review: restore workflow ref selector unchanged

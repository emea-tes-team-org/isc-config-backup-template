# Manual Backup Zipped GitHub Release Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Publish a GitHub Release with a zip of `backups/<tenant>/` when manual ISC Backup creates a new restore-point tag.

**Architecture:** A shared shell helper zips the tenant backup folder and calls `gh release create` on the backup tag. `backup.yml` invokes it after tag push; `prune-tags.mjs` deletes matching releases when tags are pruned.

**Tech Stack:** Bash, `gh` CLI, GitHub Actions, Node test scripts

**Canonical test command:** `node scripts/test-create-backup-release.mjs` and `node scripts/test-workflow-references.mjs`

---

## Task 1: Shared release helper

**Files:**
- Create: `scripts/create-backup-release.sh`
- Create: `scripts/test-create-backup-release.mjs`

**Requirements:** backup spec — "Manual backup publishes GitHub Release with zip asset"; design D3, D5

### Step 1: Write failing zip-content test

Create `scripts/test-create-backup-release.mjs` that:
1. Creates a temp dir with `backups/acme-prod/ROLE/x.json` and stray `.tenant.yaml`
2. Exports a function or runs a dry-run mode that builds zip without calling `gh`
3. Asserts zip entries include tenant JSON and exclude `.tenant.yaml`

Run: `node scripts/test-create-backup-release.mjs` — expect FAIL

### Step 2: Implement zip builder in helper

```bash
#!/usr/bin/env bash
set -euo pipefail
TAG_NAME="${1:?usage: create-backup-release.sh <tag-name> <tenant>}"
TENANT="${2:?usage: create-backup-release.sh <tag-name> <tenant>}"
BACKUP_DIR="backups/${TENANT}"
# ... validate dir exists, derive timestamp from tag, zip -r ...
```

Run test — expect PASS for zip assertions.

### Step 3: Add gh release create (mock in test via env guard)

```bash
if [ "${DRY_RUN:-}" = "1" ]; then exit 0; fi
gh release create "$TAG_NAME" --title "..." --notes "..." "$ZIP_PATH" || {
  echo "::warning::Could not create release $TAG_NAME"
  exit 0
}
```

### Step 4: Commit

```bash
git add scripts/create-backup-release.sh scripts/test-create-backup-release.mjs
git commit -m "feat(backup): add create-backup-release helper"
```

---

## Task 2: Manual backup workflow integration

**Files:**
- Modify: `.github/workflows/backup.yml`, `scripts/test-workflow-references.mjs`

**Requirements:** backup spec scenarios; design D2, D4

### Step 1: Extend workflow reference test (failing)

```javascript
assert(
  backupWorkflow.includes("create-backup-release.sh"),
  "backup.yml: manual backup creates GitHub Release"
);
assert(
  !scheduledBackup.includes("create-backup-release.sh"),
  "scheduled-backup.yml: no release creation"
);
```

Run: `node scripts/test-workflow-references.mjs` — expect FAIL

### Step 2: Add release step to backup.yml

After tag push block, when `STATUS=backed-up`:

```yaml
- name: Publish backup release
  if: env.STATUS == 'backed-up'
  env:
    GH_TOKEN: ${{ github.token }}
  run: bash scripts/create-backup-release.sh "$TAG" "${{ env.TARGET_TENANT }}"
```

Run workflow reference test — expect PASS.

### Step 3: Commit

```bash
git add .github/workflows/backup.yml scripts/test-workflow-references.mjs
git commit -m "feat(backup): publish GitHub Release on manual backup"
```

---

## Task 3: Tag retention release cleanup

**Files:**
- Modify: `scripts/prune-tags.mjs`, optionally `scripts/test-prune-tags.mjs`

**Requirements:** backup-tag-retention spec — "Pruned backup tag release is deleted"; design D6

### Step 1: Write failing test for release deletion list

Extend prune-tags tests: given tags to delete, assert `deleteReleaseForTag` is called (extract function, mock `gh`).

### Step 2: Implement release deletion

After each tag delete (or batch), run:
```javascript
execFileSync("gh", ["release", "delete", tag, "--yes"], { stdio: "pipe" });
```
Catch 404 and continue.

### Step 3: Update step summary counts

### Step 4: Commit

```bash
git add scripts/prune-tags.mjs scripts/test-prune-tags.mjs
git commit -m "feat(retention): delete GitHub Releases when pruning backup tags"
```

---

## Task 4: Documentation and changelog

**Files:**
- Modify: `README.md`, `CHANGELOG.md`

### Step 1: README — manual backup releases section

Document: run ISC Backup → Releases page → download zip.

### Step 2: CHANGELOG Unreleased entry

### Step 3: Commit

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document manual backup GitHub Releases"
```

---

## Verification

```bash
node scripts/test-create-backup-release.mjs
node scripts/test-workflow-references.mjs
node scripts/test-prune-tags.mjs   # if extended
openspec validate backup-creates-zipped-release --type change --strict
```

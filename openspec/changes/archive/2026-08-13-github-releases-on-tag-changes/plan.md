# GitHub Releases on Tag Content Changes Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Skip GitHub Release creation when a new restore-point tag's `backups/` tree matches the previous tenant tag; publish release when content changed or on first tag.

**Architecture:** Extend `create-backup-release.sh` to resolve the previous tenant tag by embedded timestamp, compare `backups/` tree SHAs at tag refs, and only then build the zip and call `gh release create`. Workflows remain unchanged.

**Tech Stack:** Bash, git, `gh` CLI, GitHub Actions, Node test scripts

**Canonical test command:** `node scripts/test-create-backup-release.mjs` and `node scripts/test-workflow-references.mjs`

---

## Task 1: Content-change gate in release helper

**Files:**
- Modify: `scripts/create-backup-release.sh`

**Requirements:** backup spec — "Backup workflows publish GitHub Release with zip asset"; scheduled-backup spec — same gate; design D2, D3, D4

### Step 1: Write failing test for unchanged tree skip

In `scripts/test-create-backup-release.mjs`, add a git fixture:
1. Init temp repo, commit `backups/ROLE/x.json`
2. Create tag `acme-prod/2026-08-04_12-00-00` via backups-only commit-tree pattern (or mock `git rev-parse` env)
3. Create second tag `acme-prod/2026-08-05_12-00-00` with same backups tree
4. Run helper with mock `gh` — assert no `release create` call and output includes `skipping release`

Run: `node scripts/test-create-backup-release.mjs` — expect FAIL

### Step 2: Implement previous-tag lookup

Add bash function in `create-backup-release.sh`:

```bash
find_previous_tenant_tag() {
  local tenant="$1" current="$2"
  git tag -l "${tenant}/*" | while read -r tag; do
    [ "$tag" = "$current" ] && continue
    # emit tag + parsed epoch for sort
  done | sort -rn | head -1
}
```

Use embedded timestamp parsing consistent with `parseTagTimestamp` regex: `/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$`

### Step 3: Implement tree comparison before zip

```bash
NEW_TREE=$(git rev-parse "${TAG_NAME}:backups")
PREV_TAG=$(find_previous_tenant_tag "$TENANT" "$TAG_NAME")
if [ -n "$PREV_TAG" ]; then
  PREV_TREE=$(git rev-parse "${PREV_TAG}:backups")
  if [ "$NEW_TREE" = "$PREV_TREE" ]; then
    echo "Backup content unchanged vs ${PREV_TAG} — skipping release"
    exit 0
  fi
fi
# existing zip + gh release create below
```

Run test — expect PASS for skip scenario.

### Step 4: Add test for changed content publishes

Fixture with different file in second tag tree — assert `gh release create` invoked.

### Step 5: Add test for first tag (no previous)

Empty tag list except current — assert release created.

Run: `node scripts/test-create-backup-release.mjs` — all PASS

---

## Task 2: Documentation and changelog

**Files:**
- Modify: `README.md` (or generated template if releases section lives there)
- Modify: `CHANGELOG.md`

**Requirements:** tasks §4, §5

### Step 1: Update README release behavior note

Document that tags are always pushed; GitHub Releases appear only when backup content changed vs the previous restore point.

### Step 2: Update CHANGELOG Unreleased

Replace or amend the entry that says scheduled backups publish releases on unchanged runs.

---

## Task 3: Workflow reference smoke test

**Files:**
- Verify: `.github/workflows/isc-backup.yml`, `.github/workflows/scheduled-backup.yml`

### Step 1: Run workflow reference tests

```bash
node scripts/test-workflow-references.mjs
```

Expect PASS — no YAML changes required per design D5.

---

## Verification checklist

- [ ] Unchanged backup: tag pushed, release skipped, workflow succeeds
- [ ] Changed backup: tag pushed, release with zip created
- [ ] First tenant tag: release created
- [ ] `gh release create` failure: warning, exit 0, tag preserved
- [ ] `node scripts/test-create-backup-release.mjs` passes
- [ ] `node scripts/test-workflow-references.mjs` passes

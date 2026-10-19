## Why

The refactor that replaced `scripts/backup-stats.sh` with `scripts/generate-backup-stats.mjs` (archived as `2026-06-18-refactor-dashboard-generation`) deleted the shell script but never updated the caller references in `backup.yml` and `scheduled-backup.yml`.

Both workflows still call:

```yaml
STATS=$(bash scripts/backup-stats.sh)
```

This produces:

```
bash: scripts/backup-stats.sh: No such file or directory
Error: Process completed with exit code 127
```

**Impact:** Newly onboarded tenants (e.g., `axa`, `andre`) run their first backup successfully, but the stats step crashes (exit 127). Because the commit step has no `if: always()`, it never runs after a failed step. The backup files are lost and never committed to the tenant branch. The tenant remains "pending" forever because no backup tag is created.

## What Changes

- **`.github/workflows/scheduled-backup.yml` line 111:** Change `bash scripts/backup-stats.sh` to `node scripts/generate-backup-stats.mjs`
- **`.github/workflows/backup.yml` line 60:** Same change
- **`scripts/test-workflow-references.mjs` (NEW):** Regression guard that scans workflow files and asserts:
  - No reference to `scripts/backup-stats.sh`
  - Correct reference to `node scripts/generate-backup-stats.mjs` in backup workflows

## How

### Fix the caller references

Both occurrences are in the "Compute backup statistics" step. The JSON output shape is identical, so only the invocation changes:

```yaml
# Before
STATS=$(bash scripts/backup-stats.sh)

# After
STATS=$(node scripts/generate-backup-stats.mjs)
```

### Add regression guard

Create `scripts/test-workflow-references.mjs` that:
1. Reads `.github/workflows/backup.yml` and `.github/workflows/scheduled-backup.yml`
2. Asserts no file contains the string `backup-stats.sh`
3. Asserts backup.yml and scheduled-backup.yml contain `generate-backup-stats.mjs`

This can be run locally during development and optionally wired into CI.

## Scope

- **In scope:** Fix the two workflow call sites, add regression test
- **Out of scope:** Changes to dashboard.yml, restore.yml, or other workflows that don't call backup stats

## Impact

- **Code:** 2 workflow edits + 1 new test file
- **Operators:** Existing backup behavior restored; newly onboarded tenants get their first backup committed
- **Risk:** Low — the `.mjs` script was verified to work in the earlier refactor change
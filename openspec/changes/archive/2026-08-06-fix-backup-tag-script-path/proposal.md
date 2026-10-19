## Why

Scheduled and manual backup workflows switch to the tenant branch before creating restore-point tags. Tenant branches do not contain `scripts/`, so calls to `create-backup-tag.sh` fail with "No such file or directory" even when backup data was committed successfully. This leaves tags missing, marks workflows as failed, and blocks operators from using restore-point tags. The issue appeared on `main` after tag helpers were added to the commit step without restoring scripts from `main`.

## What Changes

**Tag script availability after tenant branch checkout**
- From: workflows call `bash scripts/create-backup-tag.sh` on tenant branch where `scripts/` is absent
- To: workflows restore tag helper scripts from `main` (via `git show` or `git checkout main -- scripts/...`) before invoking the helper
- Reason: tenant branches intentionally exclude workflow scripts
- Impact: non-breaking; fixes tag creation and workflow success signal

- Apply fix to `.github/workflows/backup.yml` and `.github/workflows/scheduled-backup.yml`
- Restore `create-backup-tag.sh`, `push-backup-tag.sh`, and `push-with-retry.sh`
- Extend `scripts/test-workflow-references.mjs` to assert scripts are sourced from `main` before tag step

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `backup`: tag step SHALL restore helper scripts from `main` after tenant branch checkout
- `scheduled-backup`: matrix backup tag step SHALL restore helper scripts from `main` after tenant branch checkout

## Impact

- **Modified files:** `.github/workflows/backup.yml`, `.github/workflows/scheduled-backup.yml`, `scripts/test-workflow-references.mjs`
- **GitHub Actions:** restore-point tags created successfully; workflow no longer fails at tag step when backup commit succeeds
- **Operators:** midnight backup run reports success; tags appear in GitHub Tags UI

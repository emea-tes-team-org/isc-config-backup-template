# Proposal: Backup Tag Retention

## Why

Each successful backup creates a git tag named `<tenant>/<YYYY-MM-DD_HH-MM-SS>`. Tags accumulate indefinitely on the remote repository — the only cleanup path today is Offboard, which deletes all tags for a decommissioned tenant. As tenant count and backup frequency grow, the Tags tab becomes cluttered and operators lose visibility into recent restore points. Automated retention keeps the seven newest restore points per tenant prefix while pruning older tags weekly, reducing noise without affecting active backup or restore workflows.

## What Changes

- **New workflow: ISC Prune Tags** — scheduled weekly (Sunday 03:00 UTC) plus `workflow_dispatch` with optional `dry_run`
- **New script: `scripts/prune-tags.mjs`** — lists all remote tags, groups by tenant prefix, sorts by name-embedded timestamp, keeps the 7 newest per prefix, deletes the rest
- **Retention semantics** — 7 latest restore points per tenant prefix (not calendar days); malformed tags (no embedded timestamp) are skipped
- **Scope** — all remote tags matching the backup tag naming convention, including orphaned prefixes not in `tenants.yaml`
- **README** — document the prune workflow and retention policy

**Tag retention policy**
- From: backup tags accumulate forever; only Offboard deletes tags
- To: weekly automated prune retains the 7 newest tags per tenant prefix; older tags deleted via remote ref deletion
- Reason: reduce tag clutter; bound restore-point window for operators
- Impact: non-breaking for backup/restore; old tag refs removed from GitHub UI (irreversible)

## Capabilities

### New Capabilities

- `backup-tag-retention`: weekly automated pruning of backup git tags, retaining the 7 newest restore points per tenant prefix on the remote repository

### Modified Capabilities

- `platform-integration`: add a scheduled GitHub Actions workflow for tag retention with `workflow_dispatch` and dry-run support

## Impact

- **New files:** `.github/workflows/prune-tags.yml`, `scripts/prune-tags.mjs`, `scripts/test-prune-tags.mjs`
- **Modified files:** `README.md`
- **GitHub UI:** new scheduled Action (Sunday 03:00 UTC); manual trigger with optional dry-run checkbox
- **Git operations:** bulk remote tag deletion via `git push origin :refs/tags/<tag>` (batched refspecs)
- **Permissions:** workflow needs `contents: write`; uses `ADMIN_TOKEN` or `GITHUB_TOKEN` (same pattern as offboard)
- **Restore impact:** tags older than the 7 newest per tenant are removed from the "Use workflow from" dropdown; branch commits may still exist on tenant branches
- **No breaking changes** to scheduled-backup, backup, restore, or offboard workflows; offboard continues to delete all tags on decommission

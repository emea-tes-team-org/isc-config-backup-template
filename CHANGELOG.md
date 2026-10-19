# Changelog

All notable user-facing changes to this project are documented here.

## [Unreleased]

### Changed

- **Operations dashboard README** — fleet table action legend header shows spaced icons (`💾 ⏸ ✓ ✕`) instead of a single concatenated string
- **Dashboard backup failure state** — operations dashboard **State** column shows `⚠️ Backup failed` when the latest matrix backup attempt failed, even if an older restore-point tag still exists; successful `backed-up` and `unchanged` attempts remain **Healthy**
- **GitHub Releases on content change** — ISC Backup and Scheduled Backup publish a GitHub Release with a zip of `backups/` only when the new restore-point tag's backup content differs from the previous tag; unchanged nightly runs still push tags but skip release creation

### Added

- **Scheduled Backup GitHub Releases** — scheduled backups can publish a GitHub Release with a zip of `backups/` when backup content changes (see content-change gate above)
- **Per-tenant action shortcuts** — generated workflows for backup, toggle, verify, and offboard per registry tenant; README fleet table **Actions** column links to each shortcut
- **Offboard confirmation** — per-tenant offboard shortcuts require typing `offboard` before dispatching lifecycle offboard

### Changed

- **Recent Backup Tags** — each tag name in the operations dashboard links to that restore point's GitHub Release
- **Operations dashboard README** — tenant actions embedded in fleet table; separate Per-tenant shortcuts section removed
- **Six consolidated GitHub Actions workflows** — ISC Lifecycle, ISC Backup, ISC Restore, ISC Config Tools, Scheduled Backup, and ISC Maintenance replace 14 legacy workflow files
- **Restore `source_ref` input** — ISC Restore runs from `main` only; operators pass an explicit tag or branch as `source_ref`
- **Flat backup layout** — tenant branches store backups at `backups/<TYPE>/<id>.json` (no nested `backups/<tenant>/` folder); migration script `scripts/migrate-flat-backups.mjs`
- **Tenant branch workflow cleanup** — one-time `scripts/cleanup-tenant-workflows.mjs` and **ISC Cleanup Tenant Workflows** workflow remove copied `.github/workflows/` from tenant branches
- Automated tests for README generation (`scripts/test-generate-readme.mjs`), restore paths (`scripts/test-restore.mjs`), and flat backup paths (`scripts/test-backup.mjs`)

### Changed

- **Operations dashboard README** — compact fleet table: hostname under tenant name, merged State column, icon-only action links (💾 ⏸ ✓ ✕), and nowrap on compact columns to prevent line breaks
- **Config Hub alignment** — set **Default Branch** to the tenant name and **Backups Path** to `backups` (flat layout on tenant branch)
- **Scheduled Backup** — display name updated; summary job regenerates and commits `README.md` to `main`

### Removed

- **Workflow sync to tenant branches** — `sync-workflows.yml` deleted; tenant branches are data-only (no copied workflow files)
- **Legacy workflows** — standalone onboarding, offboard, schedule-toggle, tokenize, drift-detection, dashboard, prune-tags, cleanup-deployments, re-register, and backup/restore YAML files superseded by consolidated workflows

### Added

- **Manual ISC Backup GitHub Releases** — the ISC Backup workflow publishes a GitHub Release with a zip of flat `backups/` when a manual backup commits changes and pushes a restore-point tag
- **ISC Prune Tags** GitHub Actions workflow — weekly retention (Sunday 03:00 UTC) that keeps the 7 newest backup restore points per tenant prefix and deletes older tags
- Automated tests for tag retention logic (`scripts/test-prune-tags.mjs`)
- **ISC Schedule Toggle** GitHub Actions workflow — flip a tenant's `active` flag in `tenants.yaml` to pause or resume daily scheduled backups without modifying branch history or backup tags
- **ISC Offboard** GitHub Actions workflow — decommission a tenant by removing the registry entry, deleting backup tags (`<tenant>/*`), and squashing the tenant branch to a single snapshot commit
- **CLI commands** `schedule-toggle` and `offboard` routed through `scripts/cli.mjs` with parity to the GitHub Actions workflows
- Automated tests for schedule toggle and offboard logic (`scripts/test-schedule-toggle.mjs`, `scripts/test-offboard.mjs`)
- **Ephemeral deployment cleanup** — scheduled and manual backup workflows delete GitHub Deployment records created for tenant Environments after each job; **ISC Cleanup Deployments** workflow sweeps historical deployment clutter (dry-run by default)
- Automated tests for deployment cleanup (`scripts/test-cleanup-deployment.mjs`)

### Fixed

- **Dashboard Last column** — Last is the latest restore-point tag date (`tenant/YYYY-MM-DD_HH-MM-SS`), not the last `backup:` commit, so unchanged nightly backups still show the last attempt
- **Ephemeral deployment cleanup** — cleanup pages through all GitHub Deployments for an environment instead of the first 100, and cleanup jobs grant `contents: read` so checkout can load the helper script

- **Manual backup job timeout** — ISC Backup resolves per-tenant `jobTimeoutMinutes` from `tenants.yaml` before the backup job runs (fixes 15-minute cap on manual `axa` dispatches with a 20-minute poll budget)

- **Backup tag script path** — scheduled and manual backup workflows restore `create-backup-tag.sh`, `push-backup-tag.sh`, and `push-with-retry.sh` from `main` before creating restore-point tags on tenant branches (fixes "No such file or directory" failures since 2026-08-05 when backup commits succeeded but tag steps failed)

### Changed

- **ISC Offboard tag retention** — offboard keeps the latest restore-point backup tag (by embedded UTC timestamp) and deletes only older `<tenant>/*` tags plus their GitHub Releases; the tenant branch and latest tag remain as archival references

- **ISC Onboarding idempotent upsert** — the onboarding workflow creates or updates tenants in place (branch metadata, environment secrets, and `tenants.yaml`) instead of failing when the tenant branch or registry entry already exists; supports secret refresh and re-onboard after offboard from the GitHub UI

- **Scheduled backup retry recovery** — retry crons no longer cancel in-progress scheduled runs, and pending detection re-includes tenants with a branch backup commit but no restore-point tag for the current window (tag-only retry without mandatory re-export)
- **Backup export resilience** — the backup script retries transient ISC export failures (`FAILED_EXTERNAL_COMMUNICATION`) up to three times and supports optional per-tenant `exportPollMinutes` / `jobTimeoutMinutes` in `tenants.yaml`; `axa` is configured with a 20-minute poll budget and 25-minute job timeout after repeated communication failures
- **Backup restore-point tags** — tags (`<tenant>/YYYY-MM-DD_HH-MM-SS`) now reference commits containing only `backups/`; tenant branch commits are unchanged. Scheduled and manual backup workflows use the same tagging behavior. Browsing or downloading a tag shows backup data only.
- **ISC Prune Tags** — also deletes GitHub Releases linked to pruned backup tags
- **GitHub Actions minutes optimization** — scheduled backups now trigger on explicit schedule windows (~8 runs/day for the midnight fleet) instead of every 15 minutes; cron runs apply the schedule gate (`--check-schedule`) again; pending detection uses tag name timestamps instead of git creatordate (fixes false retries after branch squash); idle runs skip summary/dashboard jobs; dashboard is generated inline after scheduled backups instead of via a separate `workflow_run` trigger; npm dependency cache and 15-minute job timeouts added to backup workflows
- **`onboard --remove`** is deprecated in favor of `offboard`, which performs full decommission cleanup (tags, branch squash) in addition to registry removal

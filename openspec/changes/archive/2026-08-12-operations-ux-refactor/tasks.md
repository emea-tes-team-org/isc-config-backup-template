# Tasks: Operations UX Refactor

## 1. Workflow sync removal

- [x] 1.1 Delete `.github/workflows/sync-workflows.yml`
- [x] 1.2 Add one-time cleanup script/workflow to remove `.github/workflows/` from all tenant branches
- [x] 1.3 Run cleanup against fleet (fernando, andre, ksb, abb-pov, abb-poc, company19271-poc)
- [x] 1.4 Remove/archive `openspec/specs/workflow-sync/spec.md`
- [x] 1.5 Update `scripts/test-workflow-references.mjs` — maps to platform-integration "No workflow sync"

## 2. Operations dashboard (README)

- [x] 2.1 Extract technical sections from README into `docs/setup.md`, `docs/architecture.md`, `docs/cli.md`, `docs/tokenization.md`, `docs/restore.md`
- [x] 2.2 Create `README.template.md` with `{{OPS_DASHBOARD}}` placeholder
- [x] 2.3 Extend or replace `generate-dashboard.mjs` to render fleet table, dispatch links, architecture primer, latest report link
- [x] 2.4 Wire generator into scheduled backup summary job; commit `README.md` to `main`
- [x] 2.5 Delete standalone `dashboard.yml` workflow
- [x] 2.6 Add tests for README generation — maps to operations-dashboard scenarios

## 3. Workflow consolidation

- [x] 3.1 Create `isc-lifecycle.yml` (onboard, verify, schedule-toggle, offboard + validation)
- [x] 3.2 Create `isc-backup.yml` from existing `backup.yml` logic
- [x] 3.3 Create `isc-config-tools.yml` (tokenize sub-ops, drift-detection)
- [x] 3.4 Create `isc-maintenance.yml` (prune-tags, cleanup-deployments)
- [x] 3.5 Rename scheduled workflow display name to "Scheduled Backup"
- [x] 3.6 Delete superseded workflow files (onboarding, re-register ×2, toggle, offboard, tokenize, drift, dashboard)
- [x] 3.7 Update `scripts/test-workflow-references.mjs` — maps to platform-integration roster scenario

## 4. Restore redesign

- [x] 4.1 Add `source_ref` input to `isc-restore.yml`; remove dependency on trigger ref branch
- [x] 4.2 Update `scripts/restore.mjs` path resolution for flat `backups/`
- [x] 4.3 Update restore workflow validation job
- [x] 4.4 Add/update `scripts/test-restore.mjs` — maps to restore-operations scenarios

## 5. Flat backup path migration

- [x] 5.1 Change `BACKUP_DIR` to `"backups"` in `backup.mjs` and related scripts
- [x] 5.2 Update `onboard.mjs` `.gitignore` template for flat `backups/`
- [x] 5.3 Update `verify-onboarding.mjs`, `tokenize.mjs`, `generate-dashboard.mjs`, tag/release helpers
- [x] 5.4 Create migration script to move `backups/<tenant>/*` → `backups/` on each tenant branch
- [x] 5.5 Run migration on all tenant branches; verify backup + restore smoke test per tenant
- [x] 5.6 Update `scripts/test-backup.mjs` / related tests — maps to backup-operations flat path scenarios

## 6. Ubiquitous language & specs

- [x] 6.1 Merge journey specs per design map; archive superseded spec files
- [x] 6.2 Promote delta specs to `openspec/specs/` on archive
- [x] 6.3 Update `openspec/config.yaml` context to reflect new architecture

## 7. Documentation

- [x] 7.1 Update Config Hub section in `docs/setup.md` (tenant branch + flat `backups` path)
- [x] 7.2 Document six-workflow roster and dispatch links
- [x] 7.3 Update CHANGELOG via changelog-generator skill

## 8. Verification

- [x] 8.1 Run `openspec validate --all`
- [x] 8.2 Run affected test scripts (`test-workflow-references.mjs`, `test-restore.mjs`, dashboard/readme tests)
- [x] 8.3 Manual: trigger each consolidated workflow once from README links

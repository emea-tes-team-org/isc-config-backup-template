# Proposal: Operations UX Refactor

## Why

The ISC Config Hub CI/CD repo has grown into 14 GitHub Actions workflows, 31 overlapping capability specs, and a branch-per-tenant model that still copies workflow files onto every tenant branch. Operators cannot remember which workflow to run, contributors cannot onboard quickly, and the split between `main` (app) and tenant branches (data) is violated by `sync-workflows.yml`.

Observability is scattered across markdown reports, workflow artifacts, and the Actions sidebar with no single landing page. Restore still relies on the confusing "Use workflow from" branch/tag selector. Backup paths use a redundant `backups/<tenant>/` nesting on branches that already encode tenant identity.

This refactor establishes a clear architecture (`main` = app, tenant branch = data), reduces Actions to six focused workflows, generates README as an operations dashboard, flattens backup paths to match the original Config Hub contract, and consolidates specs into journey-based capabilities.

## What Changes

**Branch purity**
- From: `sync-workflows.yml` copies `.github/workflows/**` to every tenant branch on main push
- To: workflows exist only on `main`; one-time cleanup removes workflow files from tenant branches
- Reason: main is the app; tenant branches hold data only
- Impact: breaking for anyone triggering workflows from tenant branch refs (restore redesign addresses this)

**Backup path layout**
- From: `backups/<tenant>/<TYPE>/<id>.json` on tenant branches
- To: `backups/<TYPE>/<id>.json` on tenant branches (branch name scopes tenant)
- Reason: redundant nesting; original single-tenant design and Config Hub `Backups Path: backups` expectation
- Impact: breaking — big-bang migration on all tenant branches; scripts, tags, releases, restore paths updated

**GitHub Actions consolidation (14 → 6)**
- From: separate workflows for onboard, re-register ×2, backup, toggle, offboard, tokenize, drift, dashboard, restore, scheduled matrix, prune, cleanup, sync
- To: **ISC Lifecycle**, **ISC Backup**, **ISC Restore**, **ISC Config Tools**, **Scheduled Backup**, **ISC Maintenance**
- Reason: too many entry points; GitHub dispatch forms cannot conditionally hide inputs (6 focused forms beat 1 mega-form)
- Impact: workflow URLs change; README dispatch deep-links replace sidebar hunting

**Restore trigger**
- From: run restore workflow from source branch/tag via "Use workflow from"
- To: always run from `main`; explicit `source_ref` input (branch or tag)
- Reason: data-only tenant branches have no workflows; clearer operator model
- Impact: breaking — restore workflow inputs change

**Operations landing**
- From: long README mixing setup, tokenization, and ops; dashboard as workflow artifact only
- To: `README.md` generated from `README.template.md` (fleet table, quick actions, architecture primer); technical docs in `docs/`
- Reason: self-service ops without reading 600 lines
- Impact: non-breaking for automation; contributors edit template not generated README

**Spec consolidation**
- From: 31 flat implementation-aligned capability specs
- To: ~6 journey specs (`tenant-lifecycle`, `backup-operations`, `restore-operations`, `tokenization`, `observability`, `platform-integration`)
- Reason: specs should match operator mental model
- Impact: documentation-only restructuring; requirements preserved

**Ubiquitous language**
- From: tenant name "typically derived from subdomain"
- To: tenant name = operator-chosen identifier; `hostname` for display; optional `environment` override
- Reason: matches actual fleet (`fernando`, `andre`, etc.)
- Impact: non-breaking documentation alignment

## Capabilities

### New Capabilities

- `operations-dashboard`: generated README landing page, workflow dispatch deep-links, fleet status table, architecture primer section

### Modified Capabilities

- `ubiquitous-language`: flat `backups/` on tenant branches; tenant name semantics; main-vs-data-branch glossary entries
- `platform-integration`: six-workflow roster; delete workflow sync; data-only tenant branch contract
- `backup-operations`: flat backup path; updated tag/release zip paths
- `restore-operations`: `source_ref` input from main; path resolution for flat backups
- `scheduled-backup`: display name "Scheduled Backup" (file may remain `scheduled-backup.yml`)
- `tenant-lifecycle`: consolidated ISC Lifecycle workflow (onboard, verify, toggle, offboard)
- `tokenization`: exposed via ISC Config Tools workflow
- `reporting-observability`: README generation replaces standalone dashboard workflow
- `cli-alignment`: CLI commands mirror consolidated workflow operations

## Impact

- **Deleted:** `sync-workflows.yml`, `dashboard.yml`, `onboarding.yml`, `re-register-tenant.yml`, `re-register-all-tenants.yml`, `schedule-toggle.yml`, `offboard.yml`, `tokenize.yml`, `drift-detection.yml` (merged into new workflows)
- **New workflows:** `isc-lifecycle.yml`, `isc-backup.yml`, `isc-restore.yml`, `isc-config-tools.yml`, `isc-maintenance.yml`; `scheduled-backup.yml` renamed in UI only
- **Scripts:** `backup.mjs`, `restore.mjs`, `tokenize.mjs`, `onboard.mjs`, `generate-dashboard.mjs` → `generate-readme.mjs` (or extend), path helpers, migration script for flat backups
- **Docs:** `README.template.md`, `docs/setup.md`, `docs/architecture.md`, `docs/cli.md`, `docs/tokenization.md`, `docs/restore.md`
- **GitHub UI:** 6 Actions cards; README as operator home; restore no longer uses branch selector
- **Config Hub:** point to tenant branch + `Backups Path: backups` (flat layout restored)
- **CLI:** unchanged command surface (`npm run cli -- …`); behavior paths updated for flat backups
- **Migration order:** sync kill → README hub → workflow consolidation → restore redesign → flat path → spec consolidation

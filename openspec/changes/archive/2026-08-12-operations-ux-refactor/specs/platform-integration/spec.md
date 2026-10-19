# Platform Integration — Delta

## ADDED Requirements

### Requirement: Consolidated GitHub Actions roster

The system SHALL expose exactly six operator-facing GitHub Actions workflows on `main`: ISC Lifecycle, ISC Backup, ISC Restore, ISC Config Tools, Scheduled Backup, and ISC Maintenance.

#### Scenario: Operator sees reduced Actions menu

- **GIVEN** an operator opens the Actions tab on `main`
- **WHEN** they browse available workflows
- **THEN** at most six ISC operator workflows are listed (excluding bot or template workflows)
- **AND** legacy workflows (onboarding, sync-workflows, re-register, standalone tokenize, standalone dashboard) are absent

### Requirement: Data-only tenant branches

The system SHALL NOT copy application files to tenant branches. Workflow definitions, scripts, and registry files SHALL exist only on `main`.

#### Scenario: No workflow sync on main push

- **GIVEN** a change is pushed to `.github/workflows/` on `main`
- **WHEN** CI completes
- **THEN** tenant branches are not updated with workflow file copies
- **AND** `sync-workflows.yml` does not exist

## MODIFIED Requirements

### Requirement: Unified CLI mirrors GitHub Actions

The CLI router SHALL expose commands that map 1:1 to consolidated workflow operations: lifecycle commands (onboard, verify, schedule-toggle, offboard), backup, restore, tokenize subcommands, and drift detection.

#### Scenario: Local backup matches Action backup

- **GIVEN** a developer checks out tenant branch "acme-prod" with valid credentials in `.env`
- **WHEN** they run `npm run cli -- backup`
- **THEN** the same SP-Config export, download, and flat file layout steps execute as in `.github/workflows/isc-backup.yml`

#### Scenario: CI uses environment secrets without .env

- **GIVEN** a GitHub Actions job with `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` from the tenant Environment
- **WHEN** `node scripts/cli.mjs backup` runs
- **THEN** the CLI does not fail due to missing `.env`
- **AND** credentials come from the CI environment

#### Scenario: Schedule toggle matches Action toggle

- **GIVEN** tenant "acme-prod" has `active: true` in `tenants.yaml`
- **WHEN** the developer runs `npm run cli -- schedule-toggle acme-prod`
- **THEN** the same registry flip occurs as in ISC Lifecycle with `operation: schedule-toggle`

#### Scenario: Offboard matches Action offboard

- **GIVEN** tenant "acme-prod" is registered and has backup tags
- **WHEN** the developer runs `npm run cli -- offboard acme-prod`
- **THEN** the same registry removal, latest-tag retention (older tags deleted), and branch squash occur as in ISC Lifecycle with `operation: offboard`

#### Scenario: CLI onboard matches lifecycle workflow

- **GIVEN** an operator runs `npm run cli -- onboard --interactive`
- **WHEN** onboarding completes
- **THEN** the same artifacts are created as ISC Lifecycle with `operation: onboard`

### Requirement: GitHub Actions invoke CLI with identical syntax

Workflows SHALL invoke `node scripts/cli.mjs <command> [args]` using the same command and arguments a local developer would run.

#### Scenario: Backup workflow uses cli.mjs

- **GIVEN** `.github/workflows/isc-backup.yml` executes a backup
- **WHEN** the Run backup step runs
- **THEN** it executes `node scripts/cli.mjs backup`
- **AND** no legacy per-permutation npm scripts are used

### Requirement: Schedule toggle and offboard workflows on main

The system SHALL expose tenant lifecycle operations (schedule toggle, offboard) via ISC Lifecycle on the `main` branch.

#### Scenario: Schedule toggle workflow uses CLI in Actions

- **GIVEN** `.github/workflows/isc-lifecycle.yml` executes with `operation: schedule-toggle`
- **WHEN** the toggle step runs
- **THEN** it executes `node scripts/cli.mjs schedule-toggle <tenant-name>`
- **AND** pushes the updated `tenants.yaml` to `main`

#### Scenario: Offboard workflow uses CLI in Actions

- **GIVEN** `.github/workflows/isc-lifecycle.yml` executes with `operation: offboard`
- **WHEN** the offboard step runs
- **THEN** it executes `node scripts/cli.mjs offboard <tenant-name>`
- **AND** performs tag deletion and branch squash via the delegated script

### Requirement: Tag retention workflow on main

The system SHALL expose backup tag retention via ISC Maintenance on the `main` branch, scheduled weekly and manually triggerable.

#### Scenario: Prune tags workflow invokes retention script

- **GIVEN** `.github/workflows/isc-maintenance.yml` executes with `operation: prune-tags`
- **WHEN** the prune step runs
- **THEN** it executes `node scripts/prune-tags.mjs`

#### Scenario: Prune tags workflow uses write permissions

- **GIVEN** ISC Maintenance prune-tags runs to delete stale backup tags
- **WHEN** the workflow pushes tag deletion refspecs to origin
- **THEN** the job has `contents: write` permission
- **AND** uses `ADMIN_TOKEN` or `GITHUB_TOKEN` for authentication

#### Scenario: Prune tags workflow prevents concurrent runs

- **GIVEN** a scheduled prune run is in progress
- **WHEN** a manual `workflow_dispatch` prune is triggered
- **THEN** only one prune run executes at a time via a concurrency group

## REMOVED Requirements

### Requirement: Workflow files propagate to tenant branches

**Reason**: Superseded by data-only tenant branch model; workflow definitions exist only on `main`.

**Migration**: Run **ISC Cleanup Tenant Workflows** once to remove copied `.github/workflows/` from tenant branches.

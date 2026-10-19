# Platform Integration

## Purpose

Foundational specification for GitHub Actions ↔ CLI parity, data-only tenant branches (workflows and scripts on `main` only), and GitHub-native operator surfaces (Environments, secrets, branches, tags).

Child capabilities: `cli-alignment`, `operations-dashboard`.
## Requirements
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

### Requirement: CLI loads .env locally

When running locally, the unified CLI SHALL load `.env` from the repository root if present, without requiring manual export of secrets.

#### Scenario: .env loaded for local command

- **GIVEN** a `.env` file exists with valid ISC credentials
- **WHEN** the developer runs `npm run cli -- backup`
- **THEN** credentials from `.env` are available to the delegated script

### Requirement: GitHub Actions invoke CLI with identical syntax

Workflows SHALL invoke `node scripts/cli.mjs <command> [args]` using the same command and arguments a local developer would run.

#### Scenario: Backup workflow uses cli.mjs

- **GIVEN** `.github/workflows/isc-backup.yml` executes a backup
- **WHEN** the Run backup step runs
- **THEN** it executes `node scripts/cli.mjs backup`
- **AND** no legacy per-permutation npm scripts are used

### Requirement: GitHub Environments scope tenant secrets

Each tenant's ISC credentials SHALL be stored as Environment-scoped secrets (`TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET`) in a GitHub Environment named after the tenant, never as shared repository secrets. Backup workflows use Environments only for credential injection; Deployment records created as a side effect of `environment:` jobs are ephemeral and SHALL be removed after each backup job (see "Backup jobs remove ephemeral deployment traces").

#### Scenario: Backup job resolves tenant environment

- **GIVEN** backup runs for tenant "acme-prod"
- **WHEN** the backup job starts
- **THEN** `environment: acme-prod` is set on the job
- **AND** secrets are read from the "acme-prod" GitHub Environment

#### Scenario: Environment persists after deployment cleanup

- **GIVEN** backup job for tenant "acme-prod" completes
- **WHEN** deployment cleanup runs
- **THEN** environment "acme-prod" is not deleted
- **AND** secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` remain available for the next run

### Requirement: Backup jobs remove ephemeral deployment traces

When a backup workflow job references a tenant GitHub Environment via `environment:`, GitHub creates a Deployment record whose status mirrors the job outcome. After the backup job finishes (success or failure), the workflow SHALL deactivate and delete that Deployment record. The GitHub Environment and its secrets SHALL remain intact. Deployment cleanup failures SHALL be non-fatal.

#### Scenario: Successful scheduled backup removes deployment trace

- **GIVEN** scheduled backup completes successfully for tenant "acme-prod"
- **AND** GitHub created deployment ID 12345 for environment "acme-prod"
- **WHEN** the cleanup step runs
- **THEN** deployment 12345 is marked inactive
- **AND** deployment 12345 is deleted via the REST API
- **AND** environment "acme-prod" still exists with secrets unchanged

#### Scenario: Failed backup still removes deployment trace

- **GIVEN** scheduled backup fails for tenant "acme-prod" (e.g. missing `TENANT_URL`)
- **AND** GitHub created deployment ID 12345 with status `failure`
- **WHEN** the cleanup step runs with `if: always()`
- **THEN** deployment 12345 is deleted
- **AND** the backup job conclusion remains `failure` in Actions run history

#### Scenario: Cleanup failure is non-fatal

- **GIVEN** backup completes for tenant "acme-prod"
- **AND** deployment deletion API call fails
- **WHEN** the cleanup step finishes
- **THEN** the workflow job does not fail solely because of cleanup
- **AND** a warning annotation is emitted

#### Scenario: Backup workflows grant deployments write permission

- **GIVEN** `.github/workflows/scheduled-backup.yml` or `.github/workflows/backup.yml` runs
- **WHEN** the workflow permissions are inspected
- **THEN** `deployments: write` is declared
- **AND** cleanup can authenticate with `GITHUB_TOKEN`

### Requirement: Manual deployment history sweep workflow

The system SHALL expose a `workflow_dispatch` workflow on `main` that deletes historical Deployment records for one or all tenant environments. The workflow SHALL default to dry-run mode so operators must explicitly opt in to deletion.

#### Scenario: Dry run lists deployments without deleting

- **GIVEN** operator triggers deployment cleanup with `dry_run: true`
- **WHEN** the sweep workflow runs
- **THEN** matching deployment IDs are listed in the job summary
- **AND** no deployments are deleted

#### Scenario: Sweep deletes historical deployments

- **GIVEN** operator triggers deployment cleanup with `dry_run: false`
- **AND** environment "acme-prod" has stale deployment records
- **WHEN** the sweep workflow runs
- **THEN** each matching deployment is deactivated and deleted
- **AND** environment "acme-prod" and its secrets remain

### Requirement: ADMIN_TOKEN for onboarding only

Onboarding workflows SHALL use the `ADMIN_TOKEN` repository secret (a fine-grained GitHub PAT with Administration, Environments, Contents, and Workflows read and write, plus Actions read-only) to create Environments and environment-scoped secrets, since `GITHUB_TOKEN` cannot perform those operations.

#### Scenario: Onboarding fails without ADMIN_TOKEN

- **GIVEN** `ADMIN_TOKEN` is not configured
- **WHEN** ISC Onboarding attempts to create a GitHub Environment
- **THEN** the workflow fails with a clear error about missing admin permissions

### Requirement: Minimal package.json script surface

`package.json` SHALL expose only generic entrypoints (`cli`, `start`) rather than per-command wrapper scripts.

#### Scenario: No legacy restore wrapper scripts

- **GIVEN** the CLI alignment change is applied
- **WHEN** `package.json` is inspected
- **THEN** only `cli` and `start` scripts exist as entrypoints
- **AND** commands like `restore:cross-tenant` are absent

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


# Reporting & Observability

## Purpose

Foundational specification for backup summaries, operator dashboards, schedule reporting, and drift detection between live ISC state and git backups.

Child capabilities: `backup-summary-report`, `manual-backup-summary`, `dashboard-generation`, `tenant-schedule-reporting`, `drift-detection`, `backup-stats`, `backup-file-statistics`.

## Requirements

### Requirement: Backup summary reports committed to reports/

The system SHALL produce human-readable markdown backup summary reports under `reports/backup-summary-<date>.md` after scheduled matrix runs.

#### Scenario: Daily summary after matrix backup

- **GIVEN** the scheduled backup matrix completes for one or more tenants
- **WHEN** the reporting step runs
- **THEN** a markdown summary is written to `reports/backup-summary-<YYYY-MM-DD>.md`
- **AND** the report includes per-tenant status (backed-up, unchanged, failed)
- **AND** the report includes file statistics (size, added, deleted, modified)

### Requirement: Per-tenant backup statistics

Each backup run SHALL compute statistics (total size, file count, added/deleted/modified counts) via `scripts/generate-backup-stats.mjs` and surface them in workflow output.

#### Scenario: Statistics emitted in backup workflow

- **GIVEN** a backup changes 5 files and adds 2 new files
- **WHEN** the backup workflow completes
- **THEN** the stats step outputs JSON with `added: 2`, `modified: 5`, and accurate `size` and `files` counts

### Requirement: Operator dashboard generation

The system SHALL generate a dashboard (via `dashboard.yml` workflow) that gives operators a consolidated view of tenant backup status and schedules.

#### Scenario: Dashboard workflow produces output

- **GIVEN** multiple tenants are registered in `tenants.yaml`
- **WHEN** the dashboard generation workflow runs
- **THEN** a dashboard artifact is produced reflecting tenant names, schedules, and recent backup status

#### Scenario: Dashboard marks failed backup attempts as not healthy

- **GIVEN** the scheduled backup matrix recorded `failed` for tenant `ksb` in the current run's backup results
- **WHEN** the summary job generates the operations dashboard
- **THEN** the Tenant Overview row for `ksb` shows a non-healthy State (e.g. `⚠️ Backup failed`)
- **AND** the dashboard generation step consumed the matrix backup results for that run

### Requirement: Tenant schedule reporting

The system SHALL report which tenants are scheduled, active, and pending backup for the current schedule window.

#### Scenario: Schedule report lists pending tenants

- **GIVEN** tenant "acme-prod" has `active: true` and no backup tag for today after its scheduled time
- **WHEN** the scheduled backup matrix prepare step runs
- **THEN** "acme-prod" appears in the pending backup matrix

### Requirement: Drift detection compares live ISC to git backup

The system SHALL provide **Actions > Drift Detection** to compare the current ISC tenant configuration against the latest git backup and report differences.

#### Scenario: Drift detected for changed object

- **GIVEN** tenant "acme-prod" has a WORKFLOW object modified in ISC since the last backup
- **WHEN** Drift Detection runs for "acme-prod"
- **THEN** the workflow reports the WORKFLOW object as drifted
- **AND** authentication uses the acme-prod GitHub Environment secrets

#### Scenario: Unregistered tenant rejected

- **GIVEN** "unknown-tenant" is not listed in `tenants.yaml`
- **WHEN** Drift Detection runs with tenant "unknown-tenant"
- **THEN** the workflow fails with a clear error before ISC API calls

### Requirement: Git history as audit trail

Since every backup is committed to git, operators SHALL be able to use standard git tools (`git log`, `git diff`, tags) to track configuration changes over time without additional tooling.

#### Scenario: Object history via git log

- **GIVEN** multiple backup commits exist for `backups/acme-prod/WORKFLOW/abc-123.json`
- **WHEN** an operator runs `git log -p backups/acme-prod/WORKFLOW/abc-123.json`
- **THEN** the full change history for that object is visible

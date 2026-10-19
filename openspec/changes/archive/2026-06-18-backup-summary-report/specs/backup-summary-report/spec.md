## ADDED Requirements

### Requirement: Per-tenant backup status reporting

Feature: Backup summary report
Rule: The summary job must report the outcome of every tenant backup executed in the matrix.

#### Scenario: All tenant backups succeed with changes
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** both matrix backup jobs complete with status `backed-up` and tags `tenant-a/2024-01-01_06-00-00` and `tenant-b/2024-01-01_06-00-00`
- **THEN** the Backup Summary job displays a markdown table with one row per tenant
- **AND** each row shows the tenant name, status `backed-up`, and the created tag

#### Scenario: One tenant has no changes
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** `tenant-a` completes with status `backed-up` and `tenant-b` completes with status `unchanged`
- **THEN** the Backup Summary table shows `tenant-a` as `backed-up` with its tag
- **AND** the table shows `tenant-b` as `unchanged` with no tag

#### Scenario: One tenant backup fails
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** `tenant-a` completes with status `backed-up` and `tenant-b` fails
- **THEN** the Backup Summary table shows `tenant-a` as `backed-up` with its tag
- **AND** the table shows `tenant-b` as `failed`

### Requirement: Persistent backup summary report

Feature: Backup summary report persistence
Rule: The same report shown in the Actions UI must be committed to the repository for later reference.

#### Scenario: Daily report is persisted
- **GIVEN** the Backup Summary job completes
- **WHEN** the report markdown is generated for run date `2024-01-01`
- **THEN** a file `reports/backup-summary-2024-01-01.md` is created on the tenant branch
- **AND** the file content matches the report shown in `$GITHUB_STEP_SUMMARY`

## MODIFIED Requirements

<!-- No existing requirements are modified. -->

## REMOVED Requirements

<!-- No requirements are removed. -->

# backup-summary-report Specification

## Purpose
Generate and persist a detailed backup summary report that includes per-tenant status, file statistics, timestamp, and tag information from the scheduled backup workflow.
## Requirements
### Requirement: Scheduled backup summary includes file statistics

The scheduled backup summary table MUST include file statistics for each tenant.

Feature: Backup summary report

#### Scenario: Scheduled summary shows file stats for all tenants
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** both backups complete successfully with changes
- **THEN** the Backup Summary table includes columns for size, files, added, deleted, and modified
- **AND** each row shows the matching statistics for that tenant

### Requirement: Persisted report includes file statistics

The markdown report committed to the repository MUST include the same file statistics shown in the Actions UI.

Feature: Backup summary report persistence

#### Scenario: Daily persisted report contains stats
- **GIVEN** the Backup Summary job completes for run date `2024-01-01`
- **WHEN** the report is written to `reports/backup-summary-2024-01-01.md`
- **THEN** the file includes per-tenant file statistics
- **AND** the content matches the `$GITHUB_STEP_SUMMARY` output

### Requirement: Per-tenant backup status reporting

The summary job MUST report the outcome of every tenant backup executed in the matrix, and MUST also report tenants that were skipped due to schedule non-match or because their backup is already up to date.

#### Scenario: All tenant backups succeed with changes
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** both matrix backup jobs complete with status `backed-up` and tags `tenant-a/2024-01-01_06-00-00` and `tenant-b/2024-01-01_06-00-00`
- **THEN** the Backup Summary job displays a markdown table with one row per tenant
- **AND** each row shows the tenant name, status `backed-up`, schedule, and the created tag

#### Scenario: One tenant has no changes
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** `tenant-a` completes with status `backed-up` and `tenant-b` completes with status `unchanged`
- **THEN** the Backup Summary table shows `tenant-a` as `backed-up` with its tag and schedule
- **AND** the table shows `tenant-b` as `unchanged` with no tag and its schedule

#### Scenario: One tenant backup fails
- **GIVEN** the scheduled backup workflow runs for tenants `tenant-a` and `tenant-b`
- **WHEN** `tenant-a` completes with status `backed-up` and `tenant-b` fails
- **THEN** the Backup Summary table shows `tenant-a` as `backed-up` with its tag and schedule
- **AND** the table shows `tenant-b` as `failed` with its schedule

#### Scenario: Tenant skipped due to schedule mismatch
- **GIVEN** the scheduled backup workflow runs at a time when `tenant-c`'s schedule does not match
- **WHEN** the prepare-matrix job filters out `tenant-c`
- **THEN** the Backup Summary table shows `tenant-c` as `skipped`
- **AND** the row shows `tenant-c`'s configured schedule

#### Scenario: Tenant skipped because already up to date
- **GIVEN** the workflow runs at 06:15 UTC on 2024-01-01
- **AND** `tenant-c` has schedule `"0 6 * * *"`
- **AND** `tenant-c` already has a backup tag `tenant-c/2024-01-01_06-00-00`
- **WHEN** the prepare-matrix job filters out `tenant-c`
- **THEN** the Backup Summary table shows `tenant-c` as `up-to-date`
- **AND** the row shows `tenant-c`'s configured schedule

### Requirement: Persistent backup summary report

The same report shown in the Actions UI MUST be committed to the repository for later reference.

Feature: Backup summary report persistence

#### Scenario: Daily report is persisted
- **GIVEN** the Backup Summary job completes
- **WHEN** the report markdown is generated for run date `2024-01-01`
- **THEN** a file `reports/backup-summary-2024-01-01.md` is created
- **AND** the file content matches the report shown in `$GITHUB_STEP_SUMMARY`

### Requirement: Schedule visibility in backup summary

The backup summary report SHALL display each tenant's configured backup schedule so operators can verify stagger timing at a glance.

#### Scenario: Summary report includes schedule column
- **GIVEN** the Backup Summary job completes for a scheduled run
- **AND** tenants have configured schedules in `tenants.yaml`
- **WHEN** the report is generated
- **THEN** the markdown table includes a "Schedule" column
- **AND** each row shows the tenant's cron expression or "daily" if none configured

#### Scenario: Summary report shows skipped tenants
- **GIVEN** a scheduled run at time T
- **AND** some active tenants do not have schedules matching T
- **WHEN** the Backup Summary job runs
- **THEN** the report lists skipped tenants with status "skipped" and their schedule
- **AND** the skipped count is included in the total

### Requirement: Hostname and next backup in backup summary

The backup summary report SHALL include a Hostname column showing each tenant's reference hostname from `tenants.yaml`, and a Next Backup column showing the next time a backup will fire based on the tenant's cron schedule.

Feature: Backup summary hostname and next backup

#### Scenario: Report row shows hostname
- **GIVEN** `tenants.yaml` contains `hostname: company12926-poc.identitynow-demo.com` for `company12926-poc`
- **WHEN** the Backup Summary job renders the table
- **THEN** the row for `company12926-poc` shows the hostname `company12926-poc.identitynow-demo.com` in the Hostname column

#### Scenario: Report row shows next backup for a scheduled tenant
- **GIVEN** `tenants.yaml` contains `schedule: "0 6 * * *"` for `company12926-poc`
- **WHEN** the Backup Summary job renders the table at run time `2026-06-19T12:00:00Z`
- **THEN** the Next Backup column for `company12926-poc` shows `2026-06-20 06:00 UTC`

#### Scenario: Report row shows daily for an unscheduled tenant
- **GIVEN** `tenants.yaml` has no `schedule` field for `axa`
- **WHEN** the Backup Summary job renders the table
- **THEN** the Next Backup column for `axa` shows `daily`

#### Scenario: Report row uses em-dash when hostname is missing
- **GIVEN** a tenant has no `hostname` field in `tenants.yaml`
- **WHEN** the Backup Summary job renders the table
- **THEN** the Hostname column shows `—` for that tenant


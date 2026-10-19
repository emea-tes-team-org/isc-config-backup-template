## MODIFIED Requirements

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

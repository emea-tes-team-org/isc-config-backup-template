# tenant-schedule-reporting Specification

## Purpose
TBD - created by archiving change per-tenant-backup-schedules. Update Purpose after archive.
## Requirements
### Requirement: Schedule column in backup summary report

The backup summary report SHALL display each tenant's configured backup schedule so operators can verify stagger timing at a glance.

#### Scenario: Report includes schedule column
- **GIVEN** the backup summary report is generated for date `2024-01-01`
- **AND** tenants have configured schedules in `tenants.yaml`
- **WHEN** the report markdown is written to `reports/backup-summary-2024-01-01.md`
- **THEN** the markdown table includes a "Schedule" column
- **AND** each row shows the tenant's cron expression or "daily" if none configured

#### Scenario: Report shows skipped tenants with schedule
- **GIVEN** a scheduled run at time T
- **AND** some active tenants do not have schedules matching T
- **WHEN** the report is generated
- **THEN** skipped tenants appear in the table with status "skipped"
- **AND** their schedule is shown in the Schedule column


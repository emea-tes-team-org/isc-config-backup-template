## ADDED Requirements

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

## MODIFIED Requirements

<!-- Existing requirements from the backup-summary-report capability are not changed; only extended with the added requirements above. -->

## REMOVED Requirements

<!-- No requirements are removed. -->

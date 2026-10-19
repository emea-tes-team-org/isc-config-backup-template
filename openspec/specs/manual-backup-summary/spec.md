# manual-backup-summary Specification

## Purpose
TBD - created by archiving change backup-summary-with-file-stats. Update Purpose after archive.
## Requirements
### Requirement: Manual backup summary output

The manual `backup.yml` workflow MUST print a human-readable summary of the backup result and file statistics.

Feature: Manual backup summary

#### Scenario: Manual backup succeeds with changes
- **GIVEN** `backup.yml` is triggered manually for a tenant branch
- **WHEN** the backup completes with changes committed and tagged
- **THEN** the workflow log includes the tenant name
- **AND** the log includes the backup status
- **AND** the log includes the created tag
- **AND** the log includes file statistics (size, files, added, deleted, modified)

#### Scenario: Manual backup has no changes
- **GIVEN** `backup.yml` is triggered manually for a tenant branch
- **WHEN** the backup produces no changes
- **THEN** the workflow log states that no changes were detected
- **AND** the log includes the current file statistics for `backups/`


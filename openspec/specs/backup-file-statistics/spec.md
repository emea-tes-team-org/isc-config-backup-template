# backup-file-statistics Specification

## Purpose
TBD - created by archiving change backup-summary-with-file-stats. Update Purpose after archive.
## Requirements
### Requirement: Compute backup file statistics

The backup run MUST calculate the size and file-count impact of the changes in `backups/` before committing.

Feature: Backup file statistics

#### Scenario: Backup with added, modified, and deleted files
- **GIVEN** the backup script has produced changes in `backups/`
- **WHEN** the statistics step runs before commit
- **THEN** it reports the total size of `backups/` in bytes
- **AND** it reports the total number of files in `backups/`
- **AND** it reports the number of added files
- **AND** it reports the number of deleted files
- **AND** it reports the number of modified files

#### Scenario: Backup with no changes
- **GIVEN** the backup script produces no changes in `backups/`
- **WHEN** the statistics step runs
- **THEN** all counts are zero
- **AND** the reported size matches the existing `backups/` directory size


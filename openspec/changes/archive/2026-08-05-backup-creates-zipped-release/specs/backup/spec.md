## ADDED Requirements

### Requirement: Manual backup publishes GitHub Release with zip asset

The ISC Backup workflow (`backup.yml`) SHALL create a GitHub Release on the backup restore-point tag when a new tag is pushed after a successful backup with changes. The release SHALL include a zip asset containing only the `backups/<tenant>/` directory tree. Unchanged backups that skip tag creation SHALL NOT create a release.

#### Scenario: Manual backup with changes creates release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces committed changes
- **AND** tag "acme-prod/2026-08-05_12-00-00" is pushed
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "acme-prod/2026-08-05_12-00-00"
- **AND** the release includes a zip asset containing `backups/acme-prod/` JSON files
- **AND** the zip asset does not include `.tenant.yaml` or `.gitignore`

#### Scenario: Unchanged backup skips release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces no committed changes
- **WHEN** the workflow completes
- **THEN** no new GitHub Release is created
- **AND** no new backup tag is pushed

#### Scenario: Release failure is non-fatal

- **GIVEN** manual ISC Backup completes with a pushed tag
- **AND** GitHub Release creation fails
- **WHEN** the workflow finishes
- **THEN** the workflow job does not fail solely because of release creation
- **AND** a warning annotation is emitted
- **AND** the tenant branch commit and backup tag remain on the remote

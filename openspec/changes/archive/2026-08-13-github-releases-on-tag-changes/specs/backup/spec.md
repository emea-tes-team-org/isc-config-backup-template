## MODIFIED Requirements

### Requirement: Backup workflows publish GitHub Release with zip asset

The ISC Backup and Scheduled Backup workflows SHALL invoke the shared release helper after a restore-point tag is pushed. The helper SHALL create a GitHub Release with a zip asset containing only the `backups/` directory tree **only when** the new tag's `backups/` tree differs from the previous restore-point tag's `backups/` tree for the same tenant. When backup content is unchanged, the helper SHALL skip release creation and exit successfully without calling `gh release create`. The first restore-point tag for a tenant (no prior tag) SHALL still produce a release. Release API failures SHALL remain non-fatal.

#### Scenario: Manual backup with changes creates release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces committed changes
- **AND** tag "acme-prod/2026-08-05_12-00-00" is pushed
- **AND** the previous restore-point tag "acme-prod/2026-08-04_12-00-00" has a different `backups/` tree
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "acme-prod/2026-08-05_12-00-00"
- **AND** the release includes a zip asset containing `backups/` JSON files
- **AND** the zip asset does not include `.tenant.yaml` or `.gitignore`

#### Scenario: Unchanged backup pushes tag but skips release

- **GIVEN** manual ISC Backup is triggered for tenant "acme-prod"
- **AND** the backup produces no committed changes
- **AND** tag "acme-prod/2026-08-05_12-15-00" is pushed for current HEAD
- **AND** the `backups/` tree at the new tag matches the previous restore-point tag
- **WHEN** the release step completes
- **THEN** no GitHub Release is created for "acme-prod/2026-08-05_12-15-00"
- **AND** the restore-point tag remains on the remote

#### Scenario: First restore-point tag creates release

- **GIVEN** manual ISC Backup is triggered for tenant "new-tenant"
- **AND** no prior restore-point tag exists for "new-tenant"
- **AND** tag "new-tenant/2026-08-05_12-00-00" is pushed
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "new-tenant/2026-08-05_12-00-00"

#### Scenario: Release failure is non-fatal

- **GIVEN** manual ISC Backup completes with a pushed tag whose backup content changed
- **AND** GitHub Release creation fails
- **WHEN** the workflow finishes
- **THEN** the workflow job does not fail solely because of release creation
- **AND** a warning annotation is emitted
- **AND** the tenant branch commit and backup tag remain on the remote

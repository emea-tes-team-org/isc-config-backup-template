## MODIFIED Requirements

### Requirement: Scheduled backup publishes GitHub Release with zip asset

Each scheduled matrix backup job SHALL invoke the shared release helper after a restore-point tag is pushed. The helper SHALL create a GitHub Release with a zip asset **only when** the new tag's `backups/` tree differs from the previous restore-point tag's `backups/` tree for the same tenant. When backup content is unchanged, the helper SHALL skip release creation and exit successfully. The helper SHALL be restored from `main` after the job switched to the tenant branch. Release API failures SHALL be non-fatal.

#### Scenario: Scheduled backup with changes creates release

- **GIVEN** scheduled backup completes with changes for tenant "abb-poc"
- **AND** tag "abb-poc/2026-08-13_00-57-38" is pushed
- **AND** the `backups/` tree differs from the previous restore-point tag for "abb-poc"
- **WHEN** the release step completes
- **THEN** a GitHub Release exists with tag "abb-poc/2026-08-13_00-57-38"
- **AND** the release includes a zip asset containing `backups/` JSON files

#### Scenario: Scheduled unchanged backup pushes tag but skips release

- **GIVEN** scheduled backup finds no changes for tenant "fernando"
- **AND** tag "fernando/2026-08-13_00-57-46" is pushed for current HEAD
- **AND** the `backups/` tree at the new tag matches the previous restore-point tag
- **WHEN** the release step completes
- **THEN** no GitHub Release is created for "fernando/2026-08-13_00-57-46"
- **AND** the restore-point tag remains on the remote

#### Scenario: Scheduled release failure is non-fatal

- **GIVEN** scheduled backup completes with a pushed tag whose backup content changed
- **AND** GitHub Release creation fails
- **WHEN** the matrix job finishes
- **THEN** the backup job does not fail solely because of release creation
- **AND** a warning annotation is emitted
- **AND** the tenant branch commit and backup tag remain on the remote

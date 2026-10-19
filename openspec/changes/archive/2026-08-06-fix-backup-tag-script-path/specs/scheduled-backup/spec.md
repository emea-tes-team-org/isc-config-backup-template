## MODIFIED Requirements

### Requirement: Scheduled backup tags reference backups-only commits

When the scheduled backup matrix creates a restore-point tag (after a new branch commit or when tagging unchanged HEAD), the tag SHALL reference a commit whose root tree contains only the `backups/` directory, using the same semantics as the ISC Backup workflow. Before invoking the tag helper, the matrix backup job SHALL restore tag scripts from `main` after switching to the tenant branch.

#### Scenario: Scheduled tag after successful backup commit

- **GIVEN** scheduled backup completes with changes for tenant "acme-prod"
- **AND** tag "acme-prod/2026-08-05_00-00-00" is pushed
- **WHEN** the tagged commit tree is inspected
- **THEN** `backups/acme-prod/` is present at the tag ref
- **AND** `.tenant.yaml` is absent at the tag ref

#### Scenario: Scheduled tag on unchanged backup

- **GIVEN** scheduled backup finds no changes for tenant "acme-prod"
- **AND** the workflow tags current HEAD without a new branch commit
- **WHEN** tag "acme-prod/2026-08-05_00-15-00" is pushed
- **THEN** the tag commit tree contains only `backups/`
- **AND** `.gitignore` is absent at the tag ref

#### Scenario: Restore from scheduled backup tag

- **GIVEN** tag "acme-prod/2026-08-05_00-00-00" was created by scheduled backup
- **WHEN** restore reads `backups/acme-prod/ROLE/example.json` at that tag
- **THEN** the object file content is returned successfully

#### Scenario: Matrix backup restores tag scripts from main

- **GIVEN** scheduled matrix backup job for tenant "acme-prod"
- **AND** the job checked out tenant branch "acme-prod" for commit
- **WHEN** the tag step executes
- **THEN** tag helper scripts are loaded from `main`
- **AND** the restore-point tag is pushed without "No such file or directory" errors

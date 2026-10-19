# ISC Restore

## Purpose

Cross-tenant restore of ISC configuration from git backups via GitHub Actions and CLI, with optional token substitution.

## Requirements

### Requirement: GitHub Actions restore with source ref selection

The system SHALL provide a `workflow_dispatch` restore workflow that uses the **Use workflow from** branch/tag dropdown as the backup source and accepts a target tenant name and restore mode.

#### Scenario: Semantic diff restore from tagged backup

- **GIVEN** a backup tag "acme-prod/2026-01-15_06-00-00" exists
- **AND** tenant "acme-dev" is registered with a GitHub Environment
- **WHEN** an operator runs ISC Restore selecting tag "acme-prod/2026-01-15_06-00-00" as the workflow source, target "acme-dev", and mode "semantic-diff"
- **THEN** only objects that differ from the target tenant's current state are uploaded

#### Scenario: Full restore from tenant branch

- **GIVEN** branch "acme-prod" contains backup data under `backups/acme-prod/`
- **WHEN** an operator runs ISC Restore with source branch "acme-prod", target "acme-dev", and mode "full"
- **THEN** all objects from the source backup are uploaded to the acme-dev ISC tenant

### Requirement: CLI cross-tenant restore

The system SHALL support restoring from one tenant's backup to a different target tenant via CLI flags.

#### Scenario: Restore local backup to different target

- **GIVEN** backup data exists for tenant "tenant-b" on branch "tenant-b"
- **WHEN** a developer runs `npm run cli -- restore local --tenant tenant-b --target tenant-c`
- **THEN** restore reads `.tenant.yaml` and secrets for "tenant-c" and uploads tenant-b's backup data to tenant-c's ISC tenant

### Requirement: Vars file token substitution at restore time

The system SHALL accept an optional vars file input (GitHub Actions `vars_file` input or CLI `--vars`) to substitute `{{TOKEN}}` placeholders before upload.

#### Scenario: Restore with vars substitution via Actions

- **GIVEN** tokenized templates are the restore source
- **AND** `vars/production.vars.yaml` exists
- **WHEN** ISC Restore is run with `vars_file` set to "production"
- **THEN** all token placeholders are resolved using production vars before SP-Config import

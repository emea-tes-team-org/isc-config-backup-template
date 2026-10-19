# Restore Operations — Delta

## MODIFIED Requirements

### Requirement: Cross-tenant restore from GitHub UI

The system SHALL allow operators to restore configuration from any source branch or tag to a different target tenant using **Actions > ISC Restore > Run workflow** from `main`, with required `source_ref` input identifying the source branch or backup tag.

#### Scenario: Restore from source branch to target tenant

- **GIVEN** tenant "acme-prod" has backup data on branch "acme-prod"
- **AND** tenant "acme-dev" is registered in `tenants.yaml` with a GitHub Environment
- **WHEN** an operator runs ISC Restore from `main` with `source_ref: acme-prod` and `target_tenant: acme-dev`
- **THEN** configuration from the source backup at flat `backups/<TYPE>/<id>.json` is uploaded to the acme-dev ISC tenant
- **AND** acme-dev environment secrets (`TENANT_URL`, `CLIENT_ID`, `CLIENT_SECRET`) are used for authentication

#### Scenario: Restore from timestamp tag

- **GIVEN** tag "acme-prod/2026-01-15_06-00-00" points to a valid backup commit
- **WHEN** ISC Restore is run from `main` with `source_ref: acme-prod/2026-01-15_06-00-00`
- **THEN** backup data from that tag's commit at flat `backups/` paths is used as the restore source

## ADDED Requirements

### Requirement: Flat backup path resolution

Restore SHALL resolve object paths as `backups/<TYPE>/<id>.json` when reading from tenant branch or tag refs.

#### Scenario: Tag restore with flat layout

- **GIVEN** a restore-point tag commit contains `backups/WORKFLOW/abc.json`
- **WHEN** restore reads from that tag
- **THEN** the object is found without a tenant-name subdirectory prefix

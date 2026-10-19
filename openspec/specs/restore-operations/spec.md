# Restore Operations

## Purpose

Foundational specification for restoring ISC configuration from git backups to the same or a different tenant, including token substitution for environment promotion.

Child capabilities: `restore`, `tokenization`.
## Requirements
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

### Requirement: Semantic diff and full restore modes

The restore workflow SHALL support `semantic-diff` (upload only changed objects) and `full` (upload all objects from source) modes.

#### Scenario: Semantic diff uploads only differences

- **GIVEN** source and target tenants differ on three WORKFLOW objects
- **WHEN** restore runs with mode "semantic-diff"
- **THEN** only the three differing objects are uploaded to the target ISC tenant

#### Scenario: Full restore uploads entire backup

- **GIVEN** source backup contains 200 configuration objects
- **WHEN** restore runs with mode "full"
- **THEN** all 200 objects are uploaded to the target ISC tenant

### Requirement: CLI cross-tenant restore

The system SHALL support restoring from one tenant's backup to a different target tenant via CLI flags.

#### Scenario: Restore local backup to different target

- **GIVEN** backup data exists for tenant "tenant-b" on branch "tenant-b"
- **WHEN** a developer runs `npm run cli -- restore local --tenant tenant-b --target tenant-c`
- **THEN** restore reads `.tenant.yaml` and credentials for "tenant-c"
- **AND** uploads tenant-b's backup data to tenant-c's ISC tenant

### Requirement: Token substitution for environment promotion

The system SHALL support restoring tokenized templates with per-tenant variable files so environment-specific values are resolved at restore time.

#### Scenario: Restore template with vars file

- **GIVEN** tokenized templates exist under `templates/default/`
- **AND** `vars/production.vars.yaml` contains resolved values for all tokens
- **WHEN** restore is invoked with `--vars production`
- **THEN** all `{{UPPER_SNAKE_CASE}}` placeholders are substituted before SP-Config import

#### Scenario: Template source when backup folder absent

- **GIVEN** no directory exists under `backups/default/`
- **AND** templates exist under `templates/default/`
- **WHEN** restore is invoked with `--tenant default`
- **THEN** restore reads from `templates/default/` automatically

### Requirement: Tokenization pipeline

The system SHALL provide CLI commands to create tokenized templates from a tenant backup, discover token values for a target tenant, and diff tenants to find token candidates.

#### Scenario: Create template from backup

- **GIVEN** backup data exists under `backups/beta-15156/`
- **WHEN** `npm run cli -- tokenize create-template beta-15156 --template default` runs
- **THEN** tokenized files are written under `templates/default/`
- **AND** `vars/beta-15156.vars.yaml` is seeded with original values

#### Scenario: Token paths configurable via token-paths.json

- **GIVEN** `token-paths.json` defines additional tokenizable paths for type SOURCE
- **WHEN** create-template runs
- **THEN** those paths are tokenized without code changes

### Requirement: Token format distinct from ISC workflow syntax

Token placeholders SHALL use `{{UPPER_SNAKE_CASE}}` format, distinct from ISC's `{{$.path}}` workflow interpolation syntax, to prevent collision at restore time.

#### Scenario: No collision with workflow interpolation

- **GIVEN** a WORKFLOW object contains ISC interpolation `{{$.trigger.identityId}}`
- **WHEN** tokenization runs on that object
- **THEN** the ISC interpolation syntax is preserved unchanged
- **AND** only environment-specific fields matching `token-paths.json` are replaced with `{{TOKEN}}` placeholders

### Requirement: Flat backup path resolution

Restore SHALL resolve object paths as `backups/<TYPE>/<id>.json` when reading from tenant branch or tag refs.

#### Scenario: Tag restore with flat layout

- **GIVEN** a restore-point tag commit contains `backups/WORKFLOW/abc.json`
- **WHEN** restore reads from that tag
- **THEN** the object is found without a tenant-name subdirectory prefix

